import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/scraper/registry";
import { BrightDataClient } from "@/lib/brightdata/client";
import { env } from "@/lib/env";
import { updateCompanyStatus } from "@/lib/scraper/registry";
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

    if (company.healing_attempts >= 2) {
      return NextResponse.json(
        { error: "Maximum healing attempts reached" },
        { status: 400 }
      );
    }

    const client = new BrightDataClient(env.brightdata.apiToken);

    logger.info("Manual heal requested", {
      operation: "heal_api",
      company: company.name,
      company_id: company.id,
      scraper_id: company.scraper_id,
    });

    await updateCompanyStatus(company.id, "self_healing", {
      healing_attempts: company.healing_attempts + 1,
    });

    // Trigger self-healing
    const prompt = `The scraper for ${company.careers_url} is not returning expected job listings. Please fix the scraper to correctly extract job postings from this careers page. Each job should have at minimum a title field.`;

    await client.triggerSelfHealing(company.scraper_id, prompt);
    const result = await client.waitForSelfHealing(company.scraper_id);

    await updateCompanyStatus(company.id, "healthy", {
      scraper_version: company.scraper_version + 1,
    });

    return NextResponse.json({
      status: "healed",
      result,
      newVersion: company.scraper_version + 1,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Heal API failed", { operation: "heal_api", error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
