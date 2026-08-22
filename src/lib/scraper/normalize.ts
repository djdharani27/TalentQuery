import { z } from "zod";
import { logger } from "@/lib/logger";
import type { Job } from "@/lib/types";

const RawJobSchema = z.record(z.string(), z.unknown());

function extractString(val: unknown): string | undefined {
  if (typeof val === "string") return val.trim() || undefined;
  if (typeof val === "number") return String(val);
  return undefined;
}

function findField(
  obj: Record<string, unknown>,
  candidates: string[]
): string | undefined {
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerMap.set(k.toLowerCase().replace(/[_\s-]+/g, ""), v);
  }
  for (const c of candidates) {
    const key = c.toLowerCase().replace(/[_\s-]+/g, "");
    const val = lowerMap.get(key);
    const extracted = extractString(val);
    if (extracted) return extracted;
  }
  return undefined;
}

function normalizeSingleJob(raw: Record<string, unknown>): Job | null {
  const title = findField(raw, [
    "title",
    "job_title",
    "jobTitle",
    "name",
    "position",
    "role",
    "job_name",
  ]);

  if (!title) return null;

  const url = findField(raw, [
    "url",
    "link",
    "job_url",
    "jobUrl",
    "apply_url",
    "applyUrl",
    "href",
    "detail_url",
  ]);

  const location = findField(raw, [
    "location",
    "city",
    "region",
    "office",
    "workplace",
    "job_location",
    "address",
  ]);

  const department = findField(raw, [
    "department",
    "team",
    "category",
    "division",
    "group",
  ]);

  const employment_type = findField(raw, [
    "employment_type",
    "employmentType",
    "type",
    "job_type",
    "jobType",
    "contract_type",
    "schedule",
  ]);

  const description = findField(raw, [
    "description",
    "summary",
    "snippet",
    "job_description",
    "about",
    "details",
  ]);

  const job: Job = { title };
  if (url) job.url = url;
  if (location) job.location = location;
  if (department) job.department = department;
  if (employment_type) job.employment_type = employment_type;
  if (description) job.description = description;

  return job;
}

export function normalizeJobs(rawData: unknown[]): Job[] {
  const jobs: Job[] = [];

  logger.info("Normalizing jobs", {
    operation: "normalize",
    raw_count: rawData.length,
  });

  for (const item of rawData) {
    if (!item || typeof item !== "object") {
      logger.debug("Skipping non-object item", {
        operation: "normalize",
        item_type: typeof item,
      });
      continue;
    }

    const parsed = RawJobSchema.safeParse(item);
    if (!parsed.success) {
      logger.debug("Skipping invalid schema", {
        operation: "normalize",
        errors: parsed.error.issues,
      });
      continue;
    }

    const job = normalizeSingleJob(parsed.data);
    if (job) {
      jobs.push(job);
    } else {
      logger.debug("Skipping job without title", {
        operation: "normalize",
        raw_keys: Object.keys(parsed.data),
      });
    }
  }

  logger.info("Normalization complete", {
    operation: "normalize",
    jobs_count: jobs.length,
  });

  return jobs;
}

export function extractRawJobs(data: unknown): unknown[] {
  logger.info("Extracting raw jobs", {
    operation: "extract",
    data_type: typeof data,
    is_array: Array.isArray(data),
  });

  if (Array.isArray(data)) {
    logger.info("Data is array", {
      operation: "extract",
      count: data.length,
    });
    return data;
  }

  if (data && typeof data === "object") {
    const values = Object.values(data);
    const arr = values.find((v) => Array.isArray(v));
    if (arr) {
      logger.info("Found array in object", {
        operation: "extract",
        count: (arr as unknown[]).length,
        keys: Object.keys(data as Record<string, unknown>),
      });
      return arr;
    }

    logger.warn("No array found in object", {
      operation: "extract",
      keys: Object.keys(data as Record<string, unknown>),
      sample: JSON.stringify(data).slice(0, 200),
    });
  }

  logger.warn("No extractable data", {
    operation: "extract",
    data_type: typeof data,
  });

  return [];
}
