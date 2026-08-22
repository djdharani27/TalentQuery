import axios, { AxiosInstance } from "axios";
import { logger } from "@/lib/logger";
import type {
  BrightDataTriggerResponse,
  BrightDataDatasetResult,
  BrightDataCollector,
  AIJobProgress,
} from "@/lib/types";

const BASE_URL = "https://api.brightdata.com";

export class BrightDataClient {
  private http: AxiosInstance;
  private apiToken: string;

  constructor(apiToken: string) {
    if (!apiToken) throw new Error("BRIGHTDATA_API_TOKEN is required");
    this.apiToken = apiToken;
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  // ── Collection API ───────────────────────────────────────────────
  async trigger(
    collectorId: string,
    inputs: Record<string, unknown>[]
  ): Promise<BrightDataTriggerResponse> {
    const start = Date.now();
    logger.info("BrightData trigger", {
      operation: "trigger",
      scraper_id: collectorId,
    });

    const { data } = await this.http.post<BrightDataTriggerResponse>(
      "/dca/trigger",
      inputs,
      { params: { collector: collectorId, queue_next: 1 } }
    );

    if (!data.collection_id) {
      throw new Error(
        `Unexpected trigger response: ${JSON.stringify(data)}`
      );
    }

    logger.info("BrightData trigger success", {
      operation: "trigger",
      scraper_id: collectorId,
      duration_ms: Date.now() - start,
    });

    return data;
  }

  async fetchDataset(
    snapshotId: string
  ): Promise<RawDatasetResponse> {
    const response = await this.http.get("/dca/dataset", {
      params: { id: snapshotId },
      validateStatus: () => true,
      // Force the raw text body so we can log the exact bytes Bright Data sent
      // and control JSON parsing ourselves.
      responseType: "text",
      transformResponse: [(body) => body],
    });

    const rawBody = typeof response.data === "string" ? response.data : "";
    let parsed: unknown = null;
    let parseError: string | null = null;

    if (rawBody.trim()) {
      const contentType = String(response.headers?.["content-type"] ?? "");
      const parsedBody = parseDatasetBody(rawBody, contentType);
      parsed = parsedBody.parsed;
      parseError = parsedBody.error;
    }

    // Log the raw response without the token. Response headers never contain
    // the Authorization header, but only include a couple of useful, safe ones.
    logger.info("Dataset HTTP response", {
      operation: "dataset_fetch",
      snapshot_id: snapshotId,
      http_status: response.status,
      content_type: response.headers?.["content-type"] ?? null,
      content_length: response.headers?.["content-length"] ?? null,
      raw_body_length: rawBody.length,
      raw_body: rawBody.slice(0, 500),
      parsed_type: parsed === null ? "null" : Array.isArray(parsed) ? "array" : typeof parsed,
      parse_error: parseError,
    });

    return {
      httpStatus: response.status,
      rawBody,
      parsed,
      parseError,
    };
  }

  async waitForDataset(
    snapshotId: string,
    opts: {
      pollIntervalMs?: number;
      maxAttempts?: number;
      maxDurationMs?: number;
    } = {}
  ): Promise<BrightDataDatasetResult> {
    const {
      pollIntervalMs = 5000,
      maxAttempts = 120,
      maxDurationMs = 10 * 60 * 1000,
    } = opts;
    const start = Date.now();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (Date.now() - start >= maxDurationMs) {
        throw new Error(
          `Timed out waiting for snapshot ${snapshotId} after ${maxDurationMs}ms`
        );
      }

      const raw = await this.fetchDataset(snapshotId);

      if (raw.httpStatus === 401) {
        throw new Error(
          `Bright Data authorization failed (401) while fetching snapshot ${snapshotId}`
        );
      }

      if (raw.httpStatus === 404) {
        throw new Error(
          `Bright Data snapshot ${snapshotId} not found (404); it may have expired or the id is invalid`
        );
      }

      // Transient server errors should be retried rather than treated as a
      // completed or failed collection.
      if (raw.httpStatus >= 500) {
        logger.warn("Dataset poll got transient HTTP error", {
          operation: "dataset_poll",
          snapshot_id: snapshotId,
          attempt,
          http_status: raw.httpStatus,
          raw_body: raw.rawBody.slice(0, 300),
        });
        await sleep(pollIntervalMs);
        continue;
      }

      if (raw.parseError) {
        logger.warn("Dataset response was not valid JSON", {
          operation: "dataset_poll",
          snapshot_id: snapshotId,
          attempt,
          http_status: raw.httpStatus,
          parse_error: raw.parseError,
          raw_body: raw.rawBody.slice(0, 300),
        });
        await sleep(pollIntervalMs);
        continue;
      }

      const classification = classifyDataset(raw.parsed);

      switch (classification.kind) {
        case "completed": {
          const rows = classification.rows;
          logger.info("Dataset ready", {
            operation: "dataset_poll",
            snapshot_id: snapshotId,
            attempt,
            http_status: raw.httpStatus,
            result_key: classification.resultKey,
            result_count: rows.length,
          });
          return {
            collectionId: snapshotId,
            state: rows.length > 0 ? "completed" : "completed_empty",
            rows,
            rawResponse: raw.parsed,
            httpStatus: raw.httpStatus,
            resultKey: classification.resultKey,
            statusValue: classification.statusValue,
            message: classification.message,
          };
        }
        case "pending": {
          logger.debug("Dataset still building", {
            operation: "dataset_poll",
            snapshot_id: snapshotId,
            attempt,
            http_status: raw.httpStatus,
            status: classification.statusValue ?? "unknown",
            message: classification.message,
          });
          await sleep(pollIntervalMs);
          continue;
        }
        case "failed": {
          throw new Error(
            `Bright Data snapshot ${snapshotId} ${classification.statusValue}` +
              `${classification.message ? `: ${classification.message}` : ""}`
          );
        }
        case "unrecognized": {
          throw new Error(
            `Bright Data snapshot ${snapshotId} returned an unrecognized response shape. ` +
              `Raw body: ${raw.rawBody.slice(0, 500)}`
          );
        }
      }
    }

    throw new Error(
      `Timed out waiting for snapshot ${snapshotId} after ${maxAttempts} attempts`
    );
  }

  // ── Scraper Management ───────────────────────────────────────────
  async listCollectors(
    search?: string
  ): Promise<BrightDataCollector[]> {
    const params: Record<string, string> = {};
    if (search) params.search = search;

    const { data } = await this.http.get("/dca/collectors_list", { params });
    return data.data ?? data ?? [];
  }

  async createCollector(name: string): Promise<BrightDataCollector> {
    const { data } = await this.http.post("/dca/collector", {
      name,
      deliver: { type: "api_pull" },
    });
    return data;
  }

  // ── AI Flow API ──────────────────────────────────────────────────
  async triggerAIFlow(
    collectorId: string,
    description: string,
    urls: string[]
  ): Promise<{ id: string; queued: boolean }> {
    const start = Date.now();
    logger.info("Triggering AI Flow", {
      operation: "ai_flow",
      scraper_id: collectorId,
    });

    const { data } = await this.http.post(
      `/dca/collectors/${collectorId}/automate_template`,
      { description, urls }
    );

    logger.info("AI Flow triggered", {
      operation: "ai_flow",
      scraper_id: collectorId,
      duration_ms: Date.now() - start,
    });

    return data;
  }

  async getAIJobProgress(collectorId: string): Promise<AIJobProgress> {
    const { data } = await this.http.get<AIJobProgress>(
      `/dca/collectors/${collectorId}/automate_template/progress`
    );
    return data;
  }

  async waitForAIJob(
    collectorId: string,
    opts: { pollIntervalMs?: number; maxAttempts?: number } = {}
  ): Promise<AIJobProgress> {
    const { pollIntervalMs = 10000, maxAttempts = 60 } = opts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const progress = await this.getAIJobProgress(collectorId);

      if (progress.status === "done") return progress;
      if (progress.status === "failed" || progress.status === "error") {
        throw new Error(
          `AI job failed: ${progress.error || JSON.stringify(progress)}`
        );
      }

      logger.debug("AI job progress", {
        operation: "ai_flow_poll",
        scraper_id: collectorId,
        status: progress.status,
      });

      await sleep(pollIntervalMs);
    }

    throw new Error(
      `AI job timed out for collector ${collectorId}`
    );
  }

  // ── Self-Healing API ─────────────────────────────────────────────
  async triggerSelfHealing(
    collectorId: string,
    prompt: string
  ): Promise<{ id: string }> {
    const start = Date.now();
    logger.info("Triggering self-healing", {
      operation: "self_healing",
      scraper_id: collectorId,
    });

    const { data } = await this.http.post(
      `/dca/collectors/${collectorId}/refactor_template`,
      { prompt: prompt.slice(0, 1000) }
    );

    logger.info("Self-healing triggered", {
      operation: "self_healing",
      scraper_id: collectorId,
      duration_ms: Date.now() - start,
    });

    return data;
  }

  async waitForSelfHealing(
    collectorId: string,
    opts: { pollIntervalMs?: number; maxAttempts?: number } = {}
  ): Promise<AIJobProgress> {
    const { pollIntervalMs = 10000, maxAttempts = 90 } = opts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const progress = await this.getSelfHealingProgress(collectorId);

      if (progress.status === "done") return progress;
      if (progress.status === "pending_answer") {
        // Auto-approve the proposed changes
        logger.info("Self-healing pending_answer, auto-approving", {
          operation: "self_healing",
          scraper_id: collectorId,
        });
        await this.approveSelfHealing(collectorId);
        await sleep(pollIntervalMs);
        continue;
      }
      if (progress.status === "failed" || progress.status === "error") {
        throw new Error(
          `Self-healing failed: ${progress.error || JSON.stringify(progress)}`
        );
      }

      logger.debug("Self-healing progress", {
        operation: "self_healing_poll",
        scraper_id: collectorId,
        status: progress.status,
      });

      await sleep(pollIntervalMs);
    }

    throw new Error(
      `Self-healing timed out for collector ${collectorId}`
    );
  }

  async getSelfHealingProgress(collectorId: string): Promise<AIJobProgress> {
    const { data } = await this.http.get<AIJobProgress>(
      `/dca/collectors/${collectorId}/refactor_template/progress`
    );
    return data;
  }

  private async approveSelfHealing(collectorId: string): Promise<void> {
    await this.http.post(
      `/dca/collectors/${collectorId}/resume_automation_job`,
      { message: true, auto_save: true }
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ParsedDatasetBody {
  parsed: unknown;
  error: string | null;
}

// Bright Data's DCA dataset endpoint can return either a single JSON document
// (array or object) or newline-delimited JSON (NDJSON / JSONL) when the
// collector's output is a stream of records. JSON.parse fails on JSONL, so we
// detect that case and return the records as an array.
function parseDatasetBody(rawBody: string, contentType: string): ParsedDatasetBody {
  try {
    return { parsed: JSON.parse(rawBody), error: null };
  } catch (jsonError) {
    const isJsonLines =
      /jsonl|ndjson|newline/i.test(contentType) ||
      /^\s*\{[\s\S]*\}\s*\{/m.test(rawBody);

    if (!isJsonLines) {
      return {
        parsed: null,
        error: jsonError instanceof Error ? jsonError.message : String(jsonError),
      };
    }

    const records: unknown[] = [];
    for (const line of rawBody.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch (err) {
        return {
          parsed: null,
          error: `Invalid JSONL record: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return { parsed: records, error: null };
  }
}

interface RawDatasetResponse {
  httpStatus: number;
  rawBody: string;
  parsed: unknown;
  parseError: string | null;
}

type DatasetClassification =
  | {
      kind: "completed";
      rows: unknown[];
      resultKey: string | null;
      statusValue: string | null;
      message: string | null;
    }
  | {
      kind: "pending";
      statusValue: string | null;
      message: string | null;
    }
  | {
      kind: "failed";
      statusValue: string | null;
      message: string | null;
    }
  | {
      kind: "unrecognized";
    };

const RESULT_KEYS = [
  "job_listings",
  "jobs",
  "listings",
  "data",
  "results",
  "items",
  "records",
  "rows",
] as const;

const PENDING_STATUSES = new Set([
  "building",
  "collecting",
  "pending",
  "running",
  "queued",
  "processing",
  "in_progress",
  "in-progress",
]);

const FAILED_STATUSES = new Set([
  "failed",
  "canceled",
  "cancelled",
  "error",
]);

const TERMINAL_STATUSES = new Set(["ready", "done", "completed", "success"]);

function classifyDataset(data: unknown): DatasetClassification {
  // The batch DCA endpoint returns the finished collection as a top-level JSON
  // array (empty array means finished with zero rows), and a status object
  // while it is still building.
  if (Array.isArray(data)) {
    return {
      kind: "completed",
      rows: data,
      resultKey: null,
      statusValue: null,
      message: null,
    };
  }

  if (!data || typeof data !== "object") {
    return { kind: "unrecognized" };
  }

  const obj = data as Record<string, unknown>;

  const statusValue =
    typeof obj.status === "string" ? obj.status.toLowerCase() : null;
  const message =
    typeof obj.message === "string"
      ? obj.message
      : typeof obj.error === "string"
        ? obj.error
        : null;

  // Explicit failed/canceled/error states must throw, even if another field
  // looks like an array.
  if (statusValue && FAILED_STATUSES.has(statusValue)) {
    return { kind: "failed", statusValue, message };
  }

  // Inspect known array-bearing keys first. `job_listings` is what this
  // project's collector actually returns per the captured dataset.
  for (const key of RESULT_KEYS) {
    const value = obj[key];
    if (Array.isArray(value)) {
      return {
        kind: "completed",
        rows: value,
        resultKey: key,
        statusValue,
        message,
      };
    }
  }

  // A terminal success status with no known array key is a legitimate empty
  // result. Don't mistake it for a still-building collection.
  if (statusValue && TERMINAL_STATUSES.has(statusValue)) {
    return {
      kind: "completed",
      rows: [],
      resultKey: null,
      statusValue,
      message,
    };
  }

  if (statusValue && PENDING_STATUSES.has(statusValue)) {
    return { kind: "pending", statusValue, message };
  }

  // A bare { status: "building", message: "..." } is the only documented
  // in-progress shape. Anything else is genuinely unknown, and we should not
  // guess that an arbitrary object is a successful dataset.
  return { kind: "unrecognized" };
}
