import { getSupabase } from "@/lib/db/supabase";
import { BrightDataClient } from "@/lib/brightdata/client";
import { logger } from "@/lib/logger";
import type { Company, BrightDataCollector } from "@/lib/types";

export async function findOrCreateCompany(
  name: string,
  domain: string,
  careersUrl: string
): Promise<Company> {
  const db = getSupabase();
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Check if company exists
  const { data: existing } = await db
    .from("companies")
    .select("*")
    .eq("normalized_name", normalized)
    .single();

  if (existing) {
    // Update domain/careers if we have new info
    const updates: Record<string, unknown> = {};
    if (!existing.domain && domain) updates.domain = domain;
    if (!existing.careers_url && careersUrl) updates.careers_url = careersUrl;
    if (Object.keys(updates).length > 0) {
      const { data: updated } = await db
        .from("companies")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      return updated as Company;
    }
    return existing as Company;
  }

  // Create new company
  const { data: created, error } = await db
    .from("companies")
    .insert({
      name,
      normalized_name: normalized,
      domain,
      careers_url: careersUrl,
      status: "discovering",
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create company: ${error.message}`);
  return created as Company;
}

export async function getCompany(id: string): Promise<Company | null> {
  const db = getSupabase();
  const { data } = await db
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();
  return data as Company | null;
}

export async function getCompanyByNormalized(
  normalizedName: string
): Promise<Company | null> {
  const db = getSupabase();
  const { data } = await db
    .from("companies")
    .select("*")
    .eq("normalized_name", normalizedName)
    .single();
  return data as Company | null;
}

export async function updateCompanyStatus(
  id: string,
  status: Company["status"],
  extra?: Record<string, unknown>
): Promise<void> {
  const db = getSupabase();
  await db
    .from("companies")
    .update({ status, ...extra })
    .eq("id", id);
}

export async function ensureScraper(
  company: Company,
  client: BrightDataClient
): Promise<string> {
  // Re-read from the DB instead of trusting the (possibly stale) company
  // object passed in. A previous run may have already created the collector
  // but not returned it to this caller.
  const fresh = await getCompany(company.id);
  if (fresh?.scraper_id) {
    return fresh.scraper_id;
  }

  const current = fresh ?? company;

  if (!current.careers_url) {
    throw new Error("Company careers URL is required to create scraper");
  }

  logger.info("Creating new scraper", {
    operation: "registry",
    company: current.name,
    company_id: current.id,
  });

  // Update status to creating_scraper
  await updateCompanyStatus(current.id, "creating_scraper");

  // Create scraper template via Bright Data API
  const collector = await client.createCollector(
    `${current.name} Careers`
  );

  // Persist the scraper id immediately. `createCollector` has already created
  // the collector in Bright Data, so if AI-flow generation fails or is
  // interrupted afterwards we must not lose the id and create a second orphan
  // "Draft" collector on the next run.
  const db = getSupabase();
  await db
    .from("companies")
    .update({
      scraper_id: collector.id,
    })
    .eq("id", current.id);

  // Trigger AI Flow to generate the scraper code
  await client.triggerAIFlow(
    collector.id,
    `Extract all job listings from this careers page. For each job, extract: title, location, department, employment type, description, and the URL of the individual job posting.`,
    [current.careers_url]
  );

  // Wait for AI to finish generating the scraper
  await client.waitForAIJob(collector.id);

  logger.info("Scraper created", {
    operation: "registry",
    company: current.name,
    company_id: current.id,
    scraper_id: collector.id,
  });

  return collector.id;
}

export async function getCompanyScrapers(
  client: BrightDataClient,
  search?: string
): Promise<BrightDataCollector[]> {
  return client.listCollectors(search);
}
