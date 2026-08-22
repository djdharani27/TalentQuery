function getEnv(name: string, required = true): string {
  const value = process.env[name]?.trim();
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  brightdata: {
    get apiToken() {
      return getEnv("BRIGHTDATA_API_TOKEN");
    },
    get collectorId() {
      return getEnv("BRIGHTDATA_COLLECTOR_ID");
    },
  },
  supabase: {
    get url() {
      return getEnv("NEXT_PUBLIC_SUPABASE_URL");
    },
    get anonKey() {
      return getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    },
    get serviceRoleKey() {
      return getEnv("SUPABASE_SERVICE_ROLE_KEY", false);
    },
  },
  app: {
    get url() {
      return getEnv("NEXT_PUBLIC_APP_URL", false) || "http://localhost:3000";
    },
    get isDev() {
      return process.env.NODE_ENV === "development";
    },
  },
} as const;
