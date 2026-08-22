import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/scraper/registry";
import { getScraperRuns, getHealingRuns } from "@/lib/scraper/orchestrator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const company = await getCompany(id);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const [runs, healingRuns] = await Promise.all([
      getScraperRuns(id),
      getHealingRuns(id),
    ]);

    return NextResponse.json({
      status: company.status,
      healthScore: company.last_health_score,
      lastScrape: company.last_scrape_at,
      jobCount: company.last_job_count,
      healingAttempts: company.healing_attempts,
      scraperId: company.scraper_id,
      scraperVersion: company.scraper_version,
      runs,
      healingRuns,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
