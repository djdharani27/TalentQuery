type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  company_id?: string;
  company?: string;
  scraper_id?: string;
  operation?: string;
  status?: string;
  duration_ms?: number;
  error?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "api_token",
  "apiToken",
  "BRIGHTDATA_API_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "password",
  "secret",
  "key",
]);

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) {
      clean[k] = "[REDACTED]";
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function log(level: LogLevel, message: string, ctx?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(ctx ? sanitize(ctx) : {}),
  };
  const line = JSON.stringify(entry);
  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      if (process.env.NODE_ENV === "development") console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  info: (message: string, ctx?: LogContext) => log("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => log("warn", message, ctx),
  error: (message: string, ctx?: LogContext) => log("error", message, ctx),
  debug: (message: string, ctx?: LogContext) => log("debug", message, ctx),
};
