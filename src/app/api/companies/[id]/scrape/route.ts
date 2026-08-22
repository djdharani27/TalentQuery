import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/scraper/registry";
import { executeScrape } from "@/lib/scraper/orchestrator";
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

    logger.info("Scrape requested", {
      operation: "scrape_api",
      company: company.name,
      company_id: company.id,
    });

    const result = await executeScrape(company);

    return NextResponse.json({
      jobs: result.jobs,
      healthScore: result.healthScore,
      healingTriggered: result.healingTriggered,
      runId: result.run.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Scrape API failed", { operation: "scrape_api", error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
