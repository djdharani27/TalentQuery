import { NextRequest, NextResponse } from "next/server";
import { SearchRequestSchema } from "@/lib/types";
import { discoverCompany, normalizeCompanyName } from "@/lib/company/discovery";
import {
  findOrCreateCompany,
  getCompanyByNormalized,
} from "@/lib/scraper/registry";
import { getCompanyJobs } from "@/lib/scraper/orchestrator";
import { logger } from "@/lib/logger";

function isUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

function isDomain(input: string): boolean {
  // Check if input looks like a domain (contains a dot and valid TLD)
  const trimmed = input.trim().toLowerCase();
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(trimmed);
}

function extractCompanyFromUrl(url: string): { name: string; domain: string; careersUrl: string } {
  const parsed = new URL(url.trim());
  const domain = parsed.hostname.replace(/^www\./, "");
  const name = domain.split(".")[0];
  return { name, domain, careersUrl: parsed.href };
}

function extractCompanyFromDomain(domain: string): { name: string; domain: string } {
  const clean = domain.trim().toLowerCase().replace(/^www\./, "");
  const name = clean.split(".")[0];
  return { name, domain: clean };
}

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

    const { company: input } = parsed.data;

    // Check if input is a URL
    if (isUrl(input)) {
      const { name, domain, careersUrl } = extractCompanyFromUrl(input);
      const normalized = normalizeCompanyName(name);

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

      // Create company directly from URL (skip discovery)
      const company = await findOrCreateCompany(name, domain, careersUrl);

      logger.info("Company searched (from URL)", {
        operation: "search",
        company: name,
        company_id: company.id,
        url: careersUrl,
      });

      return NextResponse.json({
        company,
        jobs: [],
        isNew: true,
      });
    }

    // Check if input is a domain (e.g., "hex.tech", "nozomio.com")
    if (isDomain(input)) {
      const { name, domain } = extractCompanyFromDomain(input);
      const normalized = normalizeCompanyName(name);

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

      // Discover careers page on this domain
      const discovery = await discoverCompany(name, domain);

      // Create company in DB
      const company = await findOrCreateCompany(
        discovery.name,
        discovery.domain,
        discovery.careersUrl
      );

      logger.info("Company searched (from domain)", {
        operation: "search",
        company: name,
        company_id: company.id,
        domain,
      });

      return NextResponse.json({
        company,
        jobs: [],
        isNew: true,
      });
    }

    // Original flow: discover company from name
    const normalized = normalizeCompanyName(input);

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
    const discovery = await discoverCompany(input);

    // Create company in DB
    const company = await findOrCreateCompany(
      discovery.name,
      discovery.domain,
      discovery.careersUrl
    );

    logger.info("Company searched", {
      operation: "search",
      company: input,
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
