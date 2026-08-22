import type { HealthScore, HealthCheck, Job } from "@/lib/types";

interface HealthContext {
  jobs: Job[];
  rawResult: unknown[];
  previousJobCount: number;
  previousHealthScore: number;
}

const WEIGHTS = {
  requestSucceeded: 15,
  hasValidContent: 10,
  hasExpectedFormat: 10,
  hasJobs: 20,
  jobsHaveTitles: 10,
  jobsHaveUrls: 10,
  urlsAreValid: 5,
  countNotCollapsed: 15,
  schemaSimilarity: 5,
};

export const HEALTH_THRESHOLDS = {
  healthy: 90,
  suspicious: 70,
};

export function calculateHealthScore(ctx: HealthContext): HealthScore {
  const checks: HealthCheck[] = [];

  // 1. Did the request succeed? (raw result exists)
  checks.push({
    name: "request_succeeded",
    passed: ctx.rawResult.length > 0,
    detail: ctx.rawResult.length > 0 ? "Data received" : "No data received",
    weight: WEIGHTS.requestSucceeded,
  });

  // 2. Was valid page content retrieved?
  const hasContent = ctx.rawResult.length > 0;
  checks.push({
    name: "has_valid_content",
    passed: hasContent,
    detail: hasContent
      ? `${ctx.rawResult.length} raw records`
      : "No content retrieved",
    weight: WEIGHTS.hasValidContent,
  });

  // 3. Is the result in expected format?
  const isExpectedFormat =
    Array.isArray(ctx.rawResult) &&
    ctx.rawResult.every((r) => typeof r === "object" && r !== null);
  checks.push({
    name: "has_expected_format",
    passed: isExpectedFormat,
    detail: isExpectedFormat
      ? "All records are objects"
      : "Result format unexpected",
    weight: WEIGHTS.hasExpectedFormat,
  });

  // 4. Were jobs found?
  checks.push({
    name: "has_jobs",
    passed: ctx.jobs.length > 0,
    detail: `${ctx.jobs.length} jobs found`,
    weight: WEIGHTS.hasJobs,
  });

  // 5. Do jobs contain titles?
  const jobsWithTitles = ctx.jobs.filter(
    (j) => j.title && j.title.length > 0
  ).length;
  const titleRatio = ctx.jobs.length > 0 ? jobsWithTitles / ctx.jobs.length : 0;
  checks.push({
    name: "jobs_have_titles",
    passed: titleRatio >= 0.8,
    detail: `${jobsWithTitles}/${ctx.jobs.length} jobs have titles`,
    weight: WEIGHTS.jobsHaveTitles,
  });

  // 6. Do jobs contain URLs?
  const jobsWithUrls = ctx.jobs.filter(
    (j) => j.url && j.url.length > 0
  ).length;
  const urlRatio = ctx.jobs.length > 0 ? jobsWithUrls / ctx.jobs.length : 0;
  checks.push({
    name: "jobs_have_urls",
    passed: urlRatio >= 0.5,
    detail: `${jobsWithUrls}/${ctx.jobs.length} jobs have URLs`,
    weight: WEIGHTS.jobsHaveUrls,
  });

  // 7. Are URLs valid?
  let validUrls = 0;
  let checkedUrls = 0;
  for (const job of ctx.jobs) {
    if (job.url) {
      checkedUrls++;
      try {
        new URL(job.url);
        validUrls++;
      } catch {
        // invalid URL
      }
    }
  }
  const urlValidRatio = checkedUrls > 0 ? validUrls / checkedUrls : 1;
  checks.push({
    name: "urls_are_valid",
    passed: urlValidRatio >= 0.8,
    detail: `${validUrls}/${checkedUrls} URLs are valid`,
    weight: WEIGHTS.urlsAreValid,
  });

  // 8. Did the number of jobs suddenly collapse?
  const countCollapsed =
    ctx.previousJobCount > 10 &&
    ctx.jobs.length < ctx.previousJobCount * 0.1;
  checks.push({
    name: "count_not_collapsed",
    passed: !countCollapsed,
    detail: countCollapsed
      ? `Collapsed from ${ctx.previousJobCount} to ${ctx.jobs.length}`
      : ctx.previousJobCount > 0
        ? `Previous: ${ctx.previousJobCount}, Current: ${ctx.jobs.length}`
        : "No previous count to compare",
    weight: WEIGHTS.countNotCollapsed,
  });

  // 9. Schema similarity (basic check)
  const schemaOk = ctx.jobs.length > 0 || ctx.previousJobCount === 0;
  checks.push({
    name: "schema_similarity",
    passed: schemaOk,
    detail: schemaOk ? "Schema consistent" : "Schema may have changed",
    weight: WEIGHTS.schemaSimilarity,
  });

  // Calculate weighted score
  let score = 0;
  let totalWeight = 0;
  for (const check of checks) {
    totalWeight += check.weight;
    if (check.passed) score += check.weight;
  }
  const normalizedScore = Math.round((score / totalWeight) * 100);

  // Determine status
  let status: HealthScore["status"];
  if (normalizedScore >= HEALTH_THRESHOLDS.healthy) {
    status = "healthy";
  } else if (normalizedScore >= HEALTH_THRESHOLDS.suspicious) {
    status = "suspicious";
  } else {
    status = "broken";
  }

  return { score: normalizedScore, status, checks };
}
