import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BrightDataClient } from "./brightdata.js";

const DEFAULT_OUTPUT_DIR = "./output";

async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    return;
  }

  const apiToken = parsed.apiToken || process.env.BRIGHTDATA_API_TOKEN;
  const collectorId = parsed.collectorId || process.env.BRIGHTDATA_COLLECTOR_ID;

  if (!apiToken || apiToken === "your_api_token_here") {
    console.error(
      "Missing BRIGHTDATA_API_TOKEN. Set it in .env or pass --token."
    );
    process.exit(1);
  }

  if (!collectorId) {
    console.error(
      "Missing BRIGHTDATA_COLLECTOR_ID. Set it in .env or pass --collector."
    );
    process.exit(1);
  }

  const urls = parsed.urls.length > 0 ? parsed.urls : ["https://hex.tech/careers/"];
  const inputs = urls.map((url) => ({ url }));

  const client = new BrightDataClient({
    apiToken,
    collectorId,
    queueNext: parsed.queueNext,
  });

  console.log(`Triggering collector ${collectorId} for ${inputs.length} URL(s)...`);
  const { collectionId, startEta } = await client.trigger(inputs);
  console.log(`Collection started: ${collectionId}`);
  if (startEta) {
    console.log(`Estimated start: ${startEta}`);
  }

  console.log("Waiting for results...");
  const data = await client.waitForDataset(collectionId, {
    pollIntervalMs: parsed.pollIntervalMs,
    maxAttempts: parsed.maxAttempts,
    onStatus: ({ attempt, statusText, message, httpStatus, raw }) => {
      console.log(
        `[poll ${attempt}] http=${httpStatus} ${statusText}: ${message}`
      );
      if (statusText === "unknown" || Array.isArray(raw)) {
        console.log(`[poll ${attempt}] raw: ${JSON.stringify(raw)}`);
      }
    },
  });

  await saveResults(data, {
    outputDir: parsed.outputDir,
    collectionId,
    jsonOnly: parsed.jsonOnly,
  });

  console.log(`\nDone. Retrieved ${countRecords(data)} record(s).`);
}

function countRecords(data) {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === "object") {
    const array = Object.values(data).find((value) => Array.isArray(value));
    return array ? array.length : 0;
  }

  return 0;
}

function parseArgs(args) {
  const result = {
    urls: [],
    help: false,
    jsonOnly: false,
    outputDir: DEFAULT_OUTPUT_DIR,
    pollIntervalMs: 10000,
    maxAttempts: 60,
    queueNext: 1,
    apiToken: null,
    collectorId: null,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        result.help = true;
        break;
      case "--url":
      case "-u":
        result.urls.push(args[++i]);
        break;
      case "--token":
        result.apiToken = args[++i];
        break;
      case "--collector":
        result.collectorId = args[++i];
        break;
      case "--output":
      case "-o":
        result.outputDir = args[++i];
        break;
      case "--interval":
        result.pollIntervalMs = Number(args[++i]);
        break;
      case "--max-attempts":
        result.maxAttempts = Number(args[++i]);
        break;
      case "--queue-next":
        result.queueNext = Number(args[++i]);
        break;
      case "--json":
        result.jsonOnly = true;
        break;
      default:
        result.urls.push(arg);
    }
  }

  return result;
}

async function saveResults(data, { outputDir, collectionId, jsonOnly }) {
  const json = JSON.stringify(data, null, 2);

  await mkdir(outputDir, { recursive: true });
  const filename = `${collectionId}.json`;
  const filePath = path.join(outputDir, filename);
  await writeFile(filePath, json, "utf8");

  if (jsonOnly) {
    console.log(json);
  }

  console.log(`Saved results to ${filePath}`);
}

function printHelp() {
  console.log(`
Scrape Verse - Bright Data Scraper Studio CLI

Usage:
  node src/index.js [urls] [options]

Options:
  -u, --url <url>         Target URL to scrape. Can be repeated.
  --token <token>         Bright Data API token (or set BRIGHTDATA_API_TOKEN).
  --collector <id>        Collector ID (or set BRIGHTDATA_COLLECTOR_ID).
  -o, --output <dir>      Output directory for saved JSON. Default: ./output
  --interval <ms>         Poll interval in milliseconds. Default: 10000
  --max-attempts <n>      Max polling attempts. Default: 60
  --queue-next <0|1>      Pass queue_next to Bright Data. Default: 1
  --json                  Print results to stdout instead of saving a file.
  -h, --help              Show this help.

Examples:
  node src/index.js
  node src/index.js https://example.com https://example.org
  node src/index.js -u https://cursor.com/careers --json
`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

