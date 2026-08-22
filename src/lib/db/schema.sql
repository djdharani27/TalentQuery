-- Scrape Verse Database Schema
-- Run this in your Supabase SQL editor

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  domain TEXT,
  careers_url TEXT,
  scraper_id TEXT,
  scraper_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'discovering',
  last_successful_scrape_at TIMESTAMPTZ,
  last_scrape_at TIMESTAMPTZ,
  last_job_count INTEGER NOT NULL DEFAULT 0,
  last_health_score INTEGER NOT NULL DEFAULT 0,
  healing_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companies_normalized_name ON companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_companies_scraper_id ON companies(scraper_id);
CREATE INDEX IF NOT EXISTS idx_companies_status ON companies(status);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  external_id TEXT,
  title TEXT NOT NULL,
  url TEXT,
  location TEXT,
  department TEXT,
  employment_type TEXT,
  description TEXT,
  raw_data JSONB DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_jobs_external_id ON jobs(external_id);
CREATE INDEX IF NOT EXISTS idx_jobs_is_active ON jobs(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_company_external ON jobs(company_id, external_id) WHERE external_id IS NOT NULL;

-- Scraper runs table
CREATE TABLE IF NOT EXISTS scraper_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scraper_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result_count INTEGER NOT NULL DEFAULT 0,
  health_score INTEGER NOT NULL DEFAULT 0,
  validation_status TEXT NOT NULL DEFAULT 'pending',
  failure_reason TEXT,
  raw_result JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_company_id ON scraper_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_scraper_id ON scraper_runs(scraper_id);
CREATE INDEX IF NOT EXISTS idx_scraper_runs_status ON scraper_runs(status);

-- Healing runs table
CREATE TABLE IF NOT EXISTS healing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  scraper_id TEXT NOT NULL,
  old_version INTEGER NOT NULL,
  new_version INTEGER,
  trigger_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  healing_request JSONB DEFAULT '{}',
  result JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_healing_runs_company_id ON healing_runs(company_id);
CREATE INDEX IF NOT EXISTS idx_healing_runs_scraper_id ON healing_runs(scraper_id);
CREATE INDEX IF NOT EXISTS idx_healing_runs_status ON healing_runs(status);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
