import axios from "axios";

const BASE_URL = "https://api.brightdata.com";

export class BrightDataClient {
  constructor({ apiToken, collectorId, queueNext = 1 } = {}) {
    if (!apiToken) {
      throw new Error("BRIGHTDATA_API_TOKEN is required.");
    }

    if (!collectorId) {
      throw new Error("BRIGHTDATA_COLLECTOR_ID is required.");
    }

    this.apiToken = apiToken;
    this.collectorId = collectorId;
    this.queueNext = queueNext;
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  async trigger(inputs) {
    const response = await this.http.post("/dca/trigger", inputs, {
      params: {
        collector: this.collectorId,
        queue_next: this.queueNext,
      },
    });

    const { collection_id: collectionId, start_eta: startEta } = response.data;

    if (!collectionId) {
      throw new Error(
        `Unexpected trigger response: ${JSON.stringify(response.data)}`
      );
    }

    return { collectionId, startEta };
  }

  async fetchDataset(collectionId) {
    const response = await this.http.get("/dca/dataset", {
      params: { id: collectionId },
    });

    return { data: response.data, status: response.status };
  }

  async waitForDataset(collectionId, { pollIntervalMs = 10000, maxAttempts = 60, onStatus } = {}) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const { data, status } = await this.fetchDataset(collectionId);

      if (isFinished(data)) {
        return data;
      }

      const statusText = data?.status ?? "unknown";
      const message = data?.message ?? "No status message returned.";

      if (onStatus) {
        onStatus({ attempt, statusText, message, httpStatus: status, raw: data });
      }

      await sleep(pollIntervalMs);
    }

    throw new Error(
      `Timed out waiting for collection ${collectionId} after ${maxAttempts} attempts.`
    );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFinished(data) {
  // Bright Data returns a status object like { status: "building" } while a
  // collection is running, then returns a JSON array when ready. An empty
  // array is a valid completed response meaning zero records were produced.
  if (Array.isArray(data)) {
    return true;
  }

  if (data && typeof data === "object") {
    const values = Object.values(data);
    return values.some((value) => Array.isArray(value));
  }

  return false;
}
