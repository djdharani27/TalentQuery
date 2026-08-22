import axios, { AxiosInstance } from "axios";
import { logger } from "@/lib/logger";
import type {
  BrightDataTriggerResponse,
  BrightDataDatasetResponse,
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
  ): Promise<BrightDataDatasetResponse> {
    const { data } = await this.http.get<BrightDataDatasetResponse>(
      "/dca/dataset",
      { params: { id: snapshotId } }
    );
    return data;
  }

  async waitForDataset(
    snapshotId: string,
    opts: {
      pollIntervalMs?: number;
      maxAttempts?: number;
    } = {}
  ): Promise<unknown[]> {
    const { pollIntervalMs = 5000, maxAttempts = 120 } = opts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const data = await this.fetchDataset(snapshotId);

      if (Array.isArray(data)) {
        return data;
      }

      if (data && typeof data === "object") {
        const values = Object.values(data);
        const arr = values.find((v) => Array.isArray(v));
        if (arr) return arr as unknown[];
      }

      await sleep(pollIntervalMs);
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
      { prompt }
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
      const progress = await this.getAIJobProgress(collectorId);

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

  private async approveSelfHealing(collectorId: string): Promise<void> {
    await this.http.post(
      `/dca/collectors/${collectorId}/automate_template/progress`,
      { approve: true }
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
