import { z } from "zod";

// ── Company ──────────────────────────────────────────────────────────
export const CompanyStatus = z.enum([
  "discovering",
  "creating_scraper",
  "scraping",
  "validating",
  "healthy",
  "suspicious",
  "broken",
  "self_healing",
  "healing_failed",
  "error",
]);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

export interface Company {
  id: string;
  name: string;
  normalized_name: string;
  domain: string | null;
  careers_url: string | null;
  scraper_id: string | null;
  scraper_version: number;
  status: CompanyStatus;
  last_successful_scrape_at: string | null;
  last_scrape_at: string | null;
  last_job_count: number;
  last_health_score: number;
  healing_attempts: number;
  created_at: string;
  updated_at: string;
}

// ── Job ──────────────────────────────────────────────────────────────
export const JobSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().optional().or(z.literal("")),
  location: z.string().optional(),
  department: z.string().optional(),
  employment_type: z.string().optional(),
  description: z.string().optional(),
});
export type Job = z.infer<typeof JobSchema>;

export interface StoredJob extends Job {
  id: string;
  company_id: string;
  external_id: string | null;
  raw_data: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

// ── Scraper Run ──────────────────────────────────────────────────────
export type ScraperRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "timeout";

export interface ScraperRun {
  id: string;
  company_id: string;
  scraper_id: string;
  status: ScraperRunStatus;
  result_count: number;
  health_score: number;
  validation_status: string;
  failure_reason: string | null;
  raw_result: unknown;
  started_at: string;
  completed_at: string | null;
}

// ── Healing Run ──────────────────────────────────────────────────────
export type HealingRunStatus =
  | "pending"
  | "running"
  | "testing"
  | "completed"
  | "failed"
  | "rejected";

export interface HealingRun {
  id: string;
  company_id: string;
  scraper_id: string;
  old_version: number;
  new_version: number | null;
  trigger_reason: string;
  status: HealingRunStatus;
  healing_request: Record<string, unknown>;
  result: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  error: string | null;
}

// ── Health Score ─────────────────────────────────────────────────────
export interface HealthScore {
  score: number;
  status: "healthy" | "suspicious" | "broken";
  checks: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  passed: boolean;
  detail: string;
  weight: number;
}

// ── API Schemas ──────────────────────────────────────────────────────
export const SearchRequestSchema = z.object({
  company: z
    .string()
    .min(1, "Company name is required")
    .max(200)
    .transform((s) => s.trim()),
});
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export interface CompanySearchResult {
  company: Company;
  jobs: Job[];
  isNew: boolean;
}

// ── Bright Data Types ────────────────────────────────────────────────
export interface BrightDataCollector {
  id: string;
  name: string;
  active: boolean;
  last_run?: string;
  deliver?: { type: string };
  output_schema?: {
    type: string;
    fields: Record<string, { type: string; active: boolean }>;
  } | null;
}

export interface BrightDataTriggerResponse {
  collection_id: string;
  start_eta?: number;
}

export type BrightDataDatasetResponse =
  | unknown[]
  | { status: string; message?: string }
  | { data: unknown[] }
  | { results: unknown[] }
  | { snapshot_id: string; status?: string }
  | Record<string, unknown>;

export interface AIJobProgress {
  step?: string;
  completed_steps?: string[];
  status: string;
  error?: string;
}

export interface SelfHealingRequest {
  prompt: string;
  custom_input?: Record<string, unknown>[];
}
