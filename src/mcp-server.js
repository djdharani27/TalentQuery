import "dotenv/config";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BrightDataClient } from "./brightdata.js";

const SERVER_NAME = "scrape-verse";
const SERVER_VERSION = "1.0.0";

const urlSchema = z
  .string()
  .trim()
  .min(1, "url is required.")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "url must be a valid http(s) URL.");

function getRequiredEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function countRecords(data) {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === "object") {
    const records = Object.values(data).find((value) => Array.isArray(value));
    return records ? records.length : 0;
  }

  return 0;
}

function toResults(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const records = Object.values(data).find((value) => Array.isArray(value));
    if (records) {
      return records;
    }
  }

  return data;
}

function createServer() {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.registerTool(
    "scrape_with_brightdata",
    {
      title: "Scrape with Bright Data",
      description:
        "Trigger the existing Bright Data Scraper Studio collector for a URL, wait for the collection to finish, and return the scraper results.",
      inputSchema: {
        url: urlSchema,
      },
    },
    async ({ url }) => {
      const apiToken = getRequiredEnv("BRIGHTDATA_API_TOKEN");
      const collectorId = getRequiredEnv("BRIGHTDATA_COLLECTOR_ID");

      const brightData = new BrightDataClient({ apiToken, collectorId });
      const { collectionId } = await brightData.trigger([{ url }]);

      let data;

      try {
        data = await brightData.waitForDataset(collectionId, {
          onStatus: ({ attempt, statusText, message }) => {
            console.error(`[mcp poll ${attempt}] ${statusText}: ${message}`);
          },
        });
      } catch (error) {
        throw new Error(
          `Bright Data collection ${collectionId} did not finish: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      const results = toResults(data);
      const resultCount = countRecords(data);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              url,
              collectionId,
              resultCount,
              results,
            }),
          },
        ],
      };
    }
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(
    `Scrape Verse MCP server failed: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  process.exit(1);
});
