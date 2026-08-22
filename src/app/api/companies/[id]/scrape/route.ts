import { NextRequest, NextResponse } from "next/server";
import { getCompany, updateCompanyStatus } from "@/lib/scraper/registry";
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

    // Start scrape in background (don't await)
    executeScrape(company).catch((err) => {
      logger.error("Background scrape failed", {
        operation: "scrape_api",
        company: company.name,
        company_id: company.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Return immediately - frontend will poll for status
    return NextResponse.json({
      status: "scraping",
      message: "Scrape started. Polling for results...",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Scrape API failed", { operation: "scrape_api", error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
