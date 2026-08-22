import { getSupabase } from "@/lib/db/supabase";
import { BrightDataClient } from "@/lib/brightdata/client";
import { normalizeJobs, extractRawJobs } from "./normalize";
import { calculateHealthScore } from "./health";
import { ensureScraper, updateCompanyStatus } from "./registry";
import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import type {
  Company,
  Job,
  ScraperRun,
  HealingRun,
  StoredJob,
} from "@/lib/types";

const MAX_HEALING_ATTEMPTS = 2;

export async function executeScrape(company: Company): Promise<{
  jobs: Job[];
  run: ScraperRun;
  healthScore: number;
  healingTriggered: boolean;
}> {
  const start = Date.now();
  const client = new BrightDataClient(env.brightdata.apiToken);
  const db = getSupabase();

  let scraperId: string | null = null;
  let runRecord: Record<string, unknown> | null = null;
  let rawResult: unknown[] = [];
  let jobs: Job[] = [];
  let failureReason: string | null = null;

  try {
    // Ensure scraper exists
    await updateCompanyStatus(company.id, "scraping");
    scraperId = await ensureScraper(company, client);

    // Create scraper run record
    const { data } = await db
      .from("scraper_runs")
      .insert({
        company_id: company.id,
        scraper_id: scraperId,
        status: "running",
      })
      .select()
      .single();
    runRecord = data;

    // Trigger scraper
    if (!company.careers_url) throw new Error("No careers URL");

    logger.info("Triggering scraper", {
      operation: "scrape",
      company: company.name,
      scraper_id: scraperId,
      url: company.careers_url,
    });

    const triggerResult = await client.trigger(scraperId, [
      { url: company.careers_url },
    ]);

    logger.info("Scraper triggered, waiting for results", {
      operation: "scrape",
      company: company.name,
      collection_id: triggerResult.collection_id,
    });

    // Wait for results
    rawResult = await client.waitForDataset(triggerResult.collection_id, {
      pollIntervalMs: 5000,
      maxAttempts: 120,
    });

    logger.info("Raw results received", {
      operation: "scrape",
      company: company.name,
      raw_count: rawResult.length,
    });

    // Normalize results
    const rawJobs = extractRawJobs(rawResult);
    jobs = normalizeJobs(rawJobs);

    logger.info("Scrape completed", {
      operation: "scrape",
      company: company.name,
      company_id: company.id,
      scraper_id: scraperId,
      result_count: jobs.length,
      duration_ms: Date.now() - start,
    });
  } catch (err) {
    failureReason = err instanceof Error ? err.message : String(err);
    logger.error("Scrape failed", {
      operation: "scrape",
      company: company.name,
      company_id: company.id,
      scraper_id: scraperId ?? undefined,
      error: failureReason,
    });
  }

  // Calculate health score
  const health = calculateHealthScore({
    jobs,
    rawResult,
    previousJobCount: company.last_job_count,
    previousHealthScore: company.last_health_score,
  });

  logger.info("Health score calculated", {
    operation: "scrape",
    company: company.name,
    health_score: health.score,
    health_status: health.status,
    job_count: jobs.length,
  });

  // Update scraper run if it was created
  if (runRecord) {
    await db
      .from("scraper_runs")
      .update({
        status: failureReason ? "failed" : "completed",
        result_count: jobs.length,
        health_score: health.score,
        validation_status: health.status,
        failure_reason: failureReason,
        raw_result: rawResult.slice(0, 10),
        completed_at: new Date().toISOString(),
      })
      .eq("id", runRecord.id);
  }

  // Save jobs if healthy
  let healingTriggered = false;

  if (health.status === "healthy" || health.status === "suspicious") {
    logger.info("Saving jobs to database", {
      operation: "scrape",
      company: company.name,
      job_count: jobs.length,
    });

    await saveJobs(company.id, jobs);

    logger.info("Updating company status", {
      operation: "scrape",
      company: company.name,
      status: health.status === "healthy" ? "healthy" : "suspicious",
      job_count: jobs.length,
      health_score: health.score,
    });

    await updateCompanyStatus(company.id, health.status === "healthy" ? "healthy" : "suspicious", {
      last_scrape_at: new Date().toISOString(),
      last_successful_scrape_at:
        health.status === "healthy"
          ? new Date().toISOString()
          : company.last_successful_scrape_at,
      last_job_count: jobs.length,
      last_health_score: health.score,
      healing_attempts: 0,
    });
  } else if (
    health.status === "broken" &&
    !failureReason &&
    company.healing_attempts < MAX_HEALING_ATTEMPTS
  ) {
    healingTriggered = true;
    await triggerSelfHealing(company, scraperId!, health, rawResult, client);
  } else {
    // broken + max attempts reached, or failure
    await updateCompanyStatus(company.id, failureReason ? "error" : "healing_failed", {
      last_scrape_at: new Date().toISOString(),
      last_health_score: health.score,
    });
  }

  return {
    jobs,
    run: { ...(runRecord || {}), status: failureReason ? "failed" : "completed" } as ScraperRun,
    healthScore: health.score,
    healingTriggered,
  };
}

async function saveJobs(companyId: string, jobs: Job[]): Promise<void> {
  const db = getSupabase();
  const now = new Date().toISOString();

  for (const job of jobs) {
    const externalId = job.url
      ? Buffer.from(job.url).toString("base64").slice(0, 255)
      : null;

    if (externalId) {
      // Upsert by company + external_id
      const { data: existing } = await db
        .from("jobs")
        .select("id")
        .eq("company_id", companyId)
        .eq("external_id", externalId)
        .single();

      if (existing) {
        await db
          .from("jobs")
          .update({
            title: job.title,
            url: job.url || null,
            location: job.location || null,
            department: job.department || null,
            employment_type: job.employment_type || null,
            description: job.description || null,
            raw_data: job,
            last_seen_at: now,
            is_active: true,
          })
          .eq("id", existing.id);
      } else {
        await db.from("jobs").insert({
          company_id: companyId,
          external_id: externalId,
          title: job.title,
          url: job.url || null,
          location: job.location || null,
          department: job.department || null,
          employment_type: job.employment_type || null,
          description: job.description || null,
          raw_data: job,
          is_active: true,
        });
      }
    } else {
      await db.from("jobs").insert({
        company_id: companyId,
        title: job.title,
        url: job.url || null,
        location: job.location || null,
        department: job.department || null,
        employment_type: job.employment_type || null,
        description: job.description || null,
        raw_data: job,
        is_active: true,
      });
    }
  }

  // Mark jobs not in this batch as inactive
  const activeUrls = jobs
    .filter((j) => j.url)
    .map((j) => j.url as string);

  if (activeUrls.length > 0) {
    // Don't deactivate everything - only deactivate jobs not seen recently
    await db
      .from("jobs")
      .update({ is_active: false })
      .eq("company_id", companyId)
      .eq("is_active", true)
      .lt(
        "last_seen_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );
  }
}

async function triggerSelfHealing(
  company: Company,
  scraperId: string,
  health: ReturnType<typeof calculateHealthScore>,
  failedResult: unknown[],
  client: BrightDataClient
): Promise<void> {
  const db = getSupabase();

  logger.info("Triggering self-healing", {
    operation: "self_healing",
    company: company.name,
    company_id: company.id,
    scraper_id: scraperId,
    health_score: health.score,
  });

  await updateCompanyStatus(company.id, "self_healing", {
    healing_attempts: company.healing_attempts + 1,
  });

  // Create healing run record
  const { data: healingRecord } = await db
    .from("healing_runs")
    .insert({
      company_id: company.id,
      scraper_id: scraperId,
      old_version: company.scraper_version,
      trigger_reason: `Health score dropped to ${health.score}. Failed checks: ${health.checks
        .filter((c) => !c.passed)
        .map((c) => c.name)
        .join(", ")}`,
      status: "running",
      healing_request: {
        health_score: health.score,
        failed_checks: health.checks.filter((c) => !c.passed),
        previous_job_count: company.last_job_count,
      },
    })
    .select()
    .single();

  try {
    // Build self-healing prompt
    const failedChecks = health.checks
      .filter((c) => !c.passed)
      .map((c) => `- ${c.name}: ${c.detail}`)
      .join("\n");

    const prompt = buildHealingPrompt(
      company.careers_url || "",
      company.last_job_count,
      failedResult,
      failedChecks
    );

    // Trigger self-healing via Bright Data API
    await client.triggerSelfHealing(scraperId, prompt);

    // Wait for self-healing to complete
    await client.waitForSelfHealing(scraperId);

    // Update healing run
    await db
      .from("healing_runs")
      .update({
        status: "completed",
        new_version: company.scraper_version + 1,
        completed_at: new Date().toISOString(),
      })
      .eq("id", healingRecord.id);

    // Update company version
    await db
      .from("companies")
      .update({
        scraper_version: company.scraper_version + 1,
        status: "healthy",
      })
      .eq("id", company.id);

    logger.info("Self-healing completed", {
      operation: "self_healing",
      company: company.name,
      company_id: company.id,
      scraper_id: scraperId,
      new_version: company.scraper_version + 1,
    });

    // Re-run the scraper to verify
    const reScrapeResult = await executeScrape({
      ...company,
      scraper_version: company.scraper_version + 1,
      healing_attempts: company.healing_attempts + 1,
      status: "healthy",
    });

    if (reScrapeResult.healthScore < 70) {
      logger.warn("Re-scrape after healing still unhealthy", {
        operation: "self_healing",
        company: company.name,
        company_id: company.id,
        health_score: reScrapeResult.healthScore,
      });
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    await db
      .from("healing_runs")
      .update({
        status: "failed",
        error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", healingRecord.id);

    if (company.healing_attempts + 1 >= MAX_HEALING_ATTEMPTS) {
      await updateCompanyStatus(company.id, "healing_failed");
    } else {
      await updateCompanyStatus(company.id, "broken");
    }

    logger.error("Self-healing failed", {
      operation: "self_healing",
      company: company.name,
      company_id: company.id,
      scraper_id: scraperId,
      error,
    });
  }
}

function buildHealingPrompt(
  careersUrl: string,
  previousJobCount: number,
  failedResult: unknown[],
  failedChecks: string
): string {
  const sampleData =
    failedResult.length > 0
      ? JSON.stringify(failedResult.slice(0, 2), null, 2)
      : "No data returned";

  return `This careers page scraper is broken and needs to be fixed.

Target URL: ${careersUrl}

Expected: An array of job listings, each with at minimum a "title" field. Previously returned ${previousJobCount} jobs.

Current result: ${failedResult.length} records returned.

Failed health checks:
${failedChecks}

Sample of current (broken) output:
${sampleData}

Please fix the scraper so it correctly extracts job listings from this careers page. Each job should have at minimum: title, and ideally location, department, employment_type, description, and url.`;
}

export async function getCompanyJobs(
  companyId: string
): Promise<StoredJob[]> {
  const db = getSupabase();
  const { data } = await db
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false });

  return (data ?? []) as StoredJob[];
}

export async function getScraperRuns(
  companyId: string
): Promise<ScraperRun[]> {
  const db = getSupabase();
  const { data } = await db
    .from("scraper_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(50);

  return (data ?? []) as ScraperRun[];
}

export async function getHealingRuns(
  companyId: string
): Promise<HealingRun[]> {
  const db = getSupabase();
  const { data } = await db
    .from("healing_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(50);

  return (data ?? []) as HealingRun[];
}
