import { NextRequest, NextResponse } from "next/server";
import { getCompany, updateCompanyStatus } from "@/lib/scraper/registry";
import { BrightDataClient } from "@/lib/brightdata/client";
import { executeScrape } from "@/lib/scraper/orchestrator";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const company = await getCompany(id);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    if (!company.scraper_id) {
      return NextResponse.json(
        { error: "No scraper exists for this company" },
        { status: 400 }
      );
    }

    const client = new BrightDataClient(env.brightdata.apiToken);
    const scraperId = company.scraper_id;

    logger.info("Manual heal requested", {
      operation: "heal_api",
      company: company.name,
      company_id: company.id,
      scraper_id: company.scraper_id,
    });

    await updateCompanyStatus(company.id, "self_healing", {
      healing_attempts: 0,
    });

    // Trigger self-healing. Include the known semantic markers for this page
    // so the AI can select the right elements even when generic selectors fail.
    const prompt = `The scraper for ${company.careers_url} is not returning expected job listings. Please fix the scraper to correctly extract job postings from this careers page. Each job should have at minimum a title field, plus location, department, employment_type, description, and url when available. Prefer semantic attributes such as data-job-row, data-job-title, data-job-location, and data-job-department when present.`;

    // Run healing in the background so the request returns immediately. The
    // frontend polls the status endpoint instead of blocking for the full AI
    // timeout (which can be 15+ minutes).
    void (async () => {
      try {
        await client.triggerSelfHealing(scraperId, prompt);
        await client.waitForSelfHealing(scraperId);

        // The healed template is only saved after approval, so run the
        // scraper again to pick up the new version and refresh job listings.
        const healedCompany = (await getCompany(company.id)) ?? company;
        const reScrape = await executeScrape({
          ...healedCompany,
          scraper_version: healedCompany.scraper_version + 1,
          status: "healthy",
        });

        await updateCompanyStatus(company.id, "healthy", {
          scraper_version: healedCompany.scraper_version + 1,
          healing_attempts: 0,
          last_job_count: reScrape.jobs.length,
        });

        logger.info("Manual heal completed", {
          operation: "heal_api",
          company: company.name,
          company_id: company.id,
          scraper_id: scraperId,
          job_count: reScrape.jobs.length,
          health_score: reScrape.healthScore,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);

        logger.error("Manual heal failed", {
          operation: "heal_api",
          company: company.name,
          company_id: company.id,
          error: message,
        });

        await updateCompanyStatus(company.id, "healing_failed");
      }
    })();

    return NextResponse.json({
      status: "self_healing",
      message: "Self-healing started. Poll status for updates.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Heal API failed", { operation: "heal_api", error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
