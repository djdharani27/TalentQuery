import { NextRequest, NextResponse } from "next/server";
import { calculateHealthScore } from "@/lib/scraper/health";
import { normalizeJobs } from "@/lib/scraper/normalize";
import { logger } from "@/lib/logger";

// Dev-only test scenarios for validating the orchestration logic
// without hitting real Bright Data APIs.

const SCENARIOS = {
  // Scenario A: successful scraper returning 100 jobs
  success: () => {
    const jobs = Array.from({ length: 100 }, (_, i) => ({
      title: `Software Engineer ${i + 1}`,
      url: `https://example.com/careers/${i + 1}`,
      location: ["New York", "San Francisco", "London", "Berlin"][i % 4],
      department: ["Engineering", "Product", "Design"][i % 3],
      employment_type: "Full-time",
    }));
    return { rawResult: jobs, previousJobCount: 100 };
  },

  // Scenario B: scraper returning 0 jobs
  zero_jobs: () => {
    return { rawResult: [], previousJobCount: 100 };
  },

  // Scenario C: scraper returning malformed data
  malformed: () => {
    return {
      rawResult: [
        "<!DOCTYPE html><html><body>Error page</body></html>",
        "not an object",
      ],
      previousJobCount: 100,
    };
  },

  // Scenario D: scraper returning jobs with missing titles/URLs
  missing_fields: () => {
    const jobs = Array.from({ length: 50 }, (_, i) => ({
      location: "New York",
      department: "Engineering",
      // Missing title and URL
      ...(i % 3 === 0 ? { title: `Job ${i}` } : {}),
    }));
    return { rawResult: jobs, previousJobCount: 100 };
  },

  // Scenario E: successful self-healing simulation
  healed: () => {
    const jobs = Array.from({ length: 120 }, (_, i) => ({
      title: `Engineer ${i + 1}`,
      url: `https://example.com/jobs/${i + 1}`,
      location: "Remote",
      department: "Engineering",
      employment_type: i % 2 === 0 ? "Full-time" : "Contract",
    }));
    return { rawResult: jobs, previousJobCount: 0 };
  },
};

type ScenarioKey = keyof typeof SCENARIOS;

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  const scenario = request.nextUrl.searchParams.get("scenario") as ScenarioKey;

  if (!scenario || !(scenario in SCENARIOS)) {
    return NextResponse.json({
      available_scenarios: Object.keys(SCENARIOS),
      usage: "GET /api/dev/test-scenarios?scenario=success",
    });
  }

  const { rawResult, previousJobCount } = SCENARIOS[scenario]();
  const jobs = normalizeJobs(rawResult);

  const health = calculateHealthScore({
    jobs,
    rawResult,
    previousJobCount,
    previousHealthScore: 100,
  });

  logger.info("Test scenario executed", {
    operation: "dev_test",
    status: scenario,
    health_score: health.score,
    health_status: health.status,
    job_count: jobs.length,
  });

  return NextResponse.json({
    scenario,
    jobs,
    jobCount: jobs.length,
    health,
    rawResultSample: rawResult.slice(0, 3),
  });
}
