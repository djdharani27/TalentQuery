import { NextRequest, NextResponse } from "next/server";
import { getCompany } from "@/lib/scraper/registry";
import {
  getScraperRuns,
  getHealingRuns,
  executeScrape,
} from "@/lib/scraper/orchestrator";
import { BrightDataClient, isApprovalPending } from "@/lib/brightdata/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let company = await getCompany(id);

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // If a healing job is running (or stalled at approval), drive it forward
    // during polling. This keeps the status endpoint from returning the same
    // "self_healing" forever when the fire-and-forget heal request is done.
    if (company.status === "self_healing" && company.scraper_id) {
      const scraperId = company.scraper_id;
      try {
        const client = new BrightDataClient(env.brightdata.apiToken);
        const progress = await client.getSelfHealingProgress(scraperId);

        if (isApprovalPending(progress)) {
          logger.info("Approving self-healing diff during status poll", {
            operation: "status_api",
            company: company.name,
            company_id: company.id,
            scraper_id: scraperId,
            step: progress.step,
          });
          await client.approveSelfHealing(scraperId);
          // Re-read after approval; the job may be done already or need another poll.
          company = (await getCompany(id)) ?? company;
        }

        const healedProgress = await client.getSelfHealingProgress(scraperId);
        const status = healedProgress.status?.toLowerCase();

        // A job is only genuinely done once the template has been saved. Treat
        // `status:"done"` at the `user_approval` step as still-in-progress.
        if (
          !isApprovalPending(healedProgress) &&
          (status === "done" ||
            status === "ready" ||
            status === "completed" ||
            status === "success" ||
            status === "finished")
        ) {
          logger.info("Self-healing completed during status poll", {
            operation: "status_api",
            company: company.name,
            company_id: company.id,
            scraper_id: scraperId,
          });

          // Apply the healed template by re-running the scraper in the
          // background. Don't block the poll: the fire-and-forget heal job in
          // the heal route owns the same work, so this only acts as a safety
          // net if that job was interrupted.
          const healedCompany = company;
          void executeScrape({
            ...healedCompany,
            scraper_version: healedCompany.scraper_version + 1,
            healing_attempts: 0,
            status: "healthy",
          }).catch((err) => {
            logger.warn("Background re-scrape after healing failed", {
              operation: "status_api",
              company_id: healedCompany.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }
      } catch (err) {
        // Healing might not be queryable yet, or the API could be transient.
        // Don't fail the status poll; report the current DB state.
        logger.warn("Could not advance self-healing during status poll", {
          operation: "status_api",
          company: company.name,
          company_id: company.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
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
