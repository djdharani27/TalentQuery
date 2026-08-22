import { NextRequest, NextResponse } from "next/server";
import { SearchRequestSchema } from "@/lib/types";
import { discoverCompany, normalizeCompanyName } from "@/lib/company/discovery";
import {
  findOrCreateCompany,
  getCompanyByNormalized,
} from "@/lib/scraper/registry";
import { getCompanyJobs } from "@/lib/scraper/orchestrator";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SearchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { company: companyName } = parsed.data;
    const normalized = normalizeCompanyName(companyName);

    // Check if company already exists in DB
    const existing = await getCompanyByNormalized(normalized);

    if (existing) {
      const jobs = await getCompanyJobs(existing.id);
      return NextResponse.json({
        company: existing,
        jobs,
        isNew: false,
      });
    }

    // Discover company
    const discovery = await discoverCompany(companyName);

    // Create company in DB
    const company = await findOrCreateCompany(
      discovery.name,
      discovery.domain,
      discovery.careersUrl
    );

    logger.info("Company searched", {
      operation: "search",
      company: companyName,
      company_id: company.id,
    });

    return NextResponse.json({
      company,
      jobs: [],
      isNew: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logger.error("Search failed", { operation: "search", error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
