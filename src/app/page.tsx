"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";

interface Company {
  id: string;
  name: string;
  domain: string | null;
  careers_url: string | null;
  scraper_id: string | null;
  scraper_version: number;
  status: string;
  last_successful_scrape_at: string | null;
  last_scrape_at: string | null;
  last_job_count: number;
  last_health_score: number;
  healing_attempts: number;
}

interface Job {
  title: string;
  url?: string;
  location?: string;
  department?: string;
  employment_type?: string;
  description?: string;
}

interface SearchResult {
  company: Company;
  jobs: Job[];
  isNew: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  discovering: "Discovering company",
  creating_scraper: "Creating scraper",
  scraping: "Scraping jobs",
  validating: "Validating results",
  healthy: "Scraper healthy",
  suspicious: "Results suspicious",
  broken: "Scraper broken",
  self_healing: "Self-healing",
  healing_failed: "Healing failed",
  error: "Scrape failed",
};

const ACTIVE_STATUSES = [
  "discovering",
  "creating_scraper",
  "scraping",
  "validating",
  "self_healing",
];

const EXAMPLE_COMPANIES = ["Cursor", "SafetyKit", "CircleBack"];

function StatusBadge({ status }: { status: string }) {
  const tone = (() => {
    if (status === "healthy") return "sv-badge--healthy";
    if (status === "suspicious") return "sv-badge--suspicious";
    if (status === "broken" || status === "error" || status === "healing_failed")
      return "sv-badge--broken";
    if (ACTIVE_STATUSES.includes(status)) return "sv-badge--processing";
    return "";
  })();

  return (
    <span className={`sv-badge ${tone}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const fill =
    score >= 90
      ? "sv-health-fill--good"
      : score >= 70
        ? "sv-health-fill--warn"
        : "sv-health-fill--bad";

  return (
    <div className="sv-health">
      <div className="sv-health-track">
        <div
          className={`sv-health-fill ${fill}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="sv-health-score">{score}/100</span>
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [healing, setHealing] = useState(false);
  const [statusPolling, setStatusPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(async (companyId: string) => {
    try {
      const res = await fetch(`/api/companies/${companyId}/status`);
      if (res.ok) {
        const data = await res.json();
        setResult((prev) =>
          prev
            ? {
                ...prev,
                company: { ...prev.company, ...data },
              }
            : prev
        );
        if (!ACTIVE_STATUSES.includes(data.status)) {
          return true;
        }
      }
    } catch {
      // ignore poll errors
    }
    return false;
  }, []);

  useEffect(() => {
    if (statusPolling && result?.company.id) {
      const poll = async () => {
        const shouldStop = await pollStatus(result.company.id);
        if (shouldStop && pollRef.current) {
          clearInterval(pollRef.current);
          setStatusPolling(false);
          const res = await fetch(`/api/companies/${result.company.id}/jobs`);
          if (res.ok) {
            const data = await res.json();
            setResult((prev) =>
              prev ? { ...prev, jobs: data.jobs } : prev
            );
          }
        }
      };

      poll();
      pollRef.current = setInterval(poll, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [statusPolling, result?.company.id, pollStatus]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/companies/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: query.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Search failed");
      }

      const data: SearchResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleScrape = useCallback(async () => {
    if (!result?.company.id) return;
    setScraping(true);
    setError(null);

    try {
      const res = await fetch(`/api/companies/${result.company.id}/scrape`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Scrape failed");
      }

      setStatusPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }, [result]);

  const handleHeal = useCallback(async () => {
    if (!result?.company.id) return;
    setHealing(true);
    setError(null);

    try {
      const res = await fetch(`/api/companies/${result.company.id}/heal`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Healing failed");
      }

      setStatusPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Healing failed");
    } finally {
      setHealing(false);
    }
  }, [result]);

  const busy = scraping || statusPolling || healing;
  const processingLabel =
    result?.company.status === "self_healing"
      ? "Self-healing in progress"
      : result?.company.status === "scraping"
        ? "Scraping in progress"
        : result?.company.status === "creating_scraper"
          ? "Creating scraper"
          : result?.company.status === "discovering"
            ? "Discovering company"
            : result?.company.status === "validating"
              ? "Validating results"
              : "Processing";

  return (
    <div
      className={
        result
          ? "flex flex-col sv-shell--results sv-bg-grid"
          : "flex flex-col sv-shell--home sv-bg-grid"
      }
    >
      <header className="sv-header">
        <div className="sv-header-inner">
          <Link href="/" className="sv-brand">
            <span className="sv-brand-mark">TQ</span>
            <span className="sv-brand-name">
              TalentQuery
            </span>
          </Link>
          <nav className="sv-nav">
            <Link href="/" className="sv-nav-link is-active">
              Careers
            </Link>
            <Link href="/admin" className="sv-nav-link">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className={result ? "sv-main" : "sv-main sv-main--home"}>
        <div
          className={
            result
              ? "sv-container sv-container--narrow"
              : "sv-container sv-container--narrow sv-container--home"
          }
        >
          {/* Hero */}
          {!result && (
            <div className="mb-14">
              <p className="sv-overline mb-4">Self-healing careers scraper</p>
              <h1 className="sv-h1">
                A scraper that
                <br />
                <span className="sv-accent">fixes itself</span> &amp;{" "}
                <span className="sv-accent">your career.</span>
              </h1>
            </div>
          )}

          {/* Search */}
          <section className="sv-search" aria-label="Search">
            <div className="sv-search-row">
              <span className="sv-search-prefix" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
              <input
                className="sv-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Company name, domain, or URL"
                disabled={loading}
                aria-label="Company name, domain, or careers URL"
              />
              <div className="sv-search-chips" aria-label="Example companies">
                {EXAMPLE_COMPANIES.map((company) => (
                  <button
                    key={company}
                    type="button"
                    className="sv-chip"
                    onClick={() => setQuery(company)}
                    disabled={loading}
                  >
                    <svg
                      className="sv-chip-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 21h18" />
                      <path d="M5 21V7l7-4 7 4v14" />
                      <path d="M9 9h1" />
                      <path d="M14 9h1" />
                      <path d="M9 13h1" />
                      <path d="M14 13h1" />
                      <path d="M9 17h1" />
                      <path d="M14 17h1" />
                    </svg>
                    {company}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="sv-search-submit"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                aria-label="Search"
                title="Search"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between gap-4 mt-3">
              <span className="sv-hint">
                Press Enter or hit search to run
              </span>
              <button
                className="sv-btn sv-btn--primary"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <span className="sv-inline-loading">
                    <span className="sv-spinner" />
                    Searching
                  </span>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </section>

          {/* Error */}
          {error && (
            <section className="sv-state sv-state--accent mt-10">
              <p className="sv-state-label">Error</p>
              <h2 className="sv-state-title">Scrape failed.</h2>
              <p className="sv-state-body">{error}</p>
            </section>
          )}

          {/* Result */}
          {result && (
            <div className="mt-12">
              {/* Company panel */}
              <section className="sv-panel">
                <div className="sv-panel-head">
                  <div className="flex items-baseline gap-4 min-w-0">
                    <h2 className="sv-h2 truncate">{result.company.name}</h2>
                    {result.company.domain && (
                      <a
                        className="sv-mono text-sm truncate"
                        href={`https://${result.company.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {result.company.domain}
                      </a>
                    )}
                  </div>
                  <StatusBadge status={result.company.status} />
                </div>

                <div className="sv-grid">
                  <div className="sv-grid-item">
                    <div className="sv-grid-key">Careers page</div>
                    <div className="sv-grid-value">
                      {result.company.careers_url ? (
                        <a
                          href={result.company.careers_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "var(--ink)" }}
                        >
                          {result.company.careers_url.replace(
                            /^https?:\/\//,
                            ""
                          )}
                        </a>
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>
                          Not found
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="sv-grid-item">
                    <div className="sv-grid-key">Health score</div>
                    <HealthBar score={result.company.last_health_score} />
                  </div>
                  <div className="sv-grid-item">
                    <div className="sv-grid-key">Jobs</div>
                    <div className="sv-grid-value">
                      {result.company.last_job_count}
                    </div>
                  </div>
                  <div className="sv-grid-item">
                    <div className="sv-grid-key">Last checked</div>
                    <div className="sv-grid-value">
                      {timeAgo(result.company.last_scrape_at)}
                    </div>
                  </div>
                </div>

                {result.company.scraper_id && (
                  <div className="sv-panel-body sv-mono flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                    <span style={{ color: "var(--ink-3)" }}>
                      Scraper:{" "}
                      <span style={{ color: "var(--ink-2)" }}>
                        {result.company.scraper_id}
                      </span>
                    </span>
                    <span style={{ color: "var(--ink-3)" }}>
                      v{result.company.scraper_version}
                    </span>
                    {result.company.healing_attempts > 0 && (
                      <span style={{ color: "var(--ink-3)" }}>
                        Healing attempts: {result.company.healing_attempts}
                      </span>
                    )}
                  </div>
                )}

                <div className="sv-panel-body flex flex-wrap gap-3">
                  <button
                    className="sv-btn sv-btn--primary"
                    onClick={handleScrape}
                    disabled={busy}
                  >
                    {scraping
                      ? "Starting"
                      : statusPolling
                        ? result.company.status === "self_healing"
                          ? "Healing"
                          : "Scraping"
                        : result.isNew
                          ? "Start Scraping"
                          : "Refresh Jobs"}
                  </button>
                  {result.company.status === "healing_failed" && (
                    <button
                      className="sv-btn sv-btn--accent"
                      onClick={handleHeal}
                      disabled={busy}
                    >
                      {healing ? "Healing" : "Heal Scraper"}
                    </button>
                  )}
                  <button
                    className="sv-btn"
                    onClick={() => {
                      setResult(null);
                      setQuery("");
                    }}
                  >
                    New Search
                  </button>
                </div>
              </section>

              {/* Processing status */}
              {statusPolling && (
                <section
                  className="sv-state mt-6"
                  style={{ borderColor: "var(--accent)" }}
                >
                  <div className="flex items-center gap-4">
                    <span className="sv-spinner" />
                    <div>
                      <p className="sv-state-label" style={{ margin: 0 }}>
                        {processingLabel}
                      </p>
                      <p
                        className="sv-state-body mt-1"
                        style={{ fontSize: 13 }}
                      >
                        {result.company.status === "self_healing"
                          ? "The scraper detected a problem and is automatically repairing itself."
                          : "This page will update automatically when complete."}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Jobs list */}
              {!scraping &&
                !healing &&
                !statusPolling &&
                result.jobs.length > 0 && (
                  <section className="sv-panel mt-12">
                    <div className="sv-section-head sv-section-head--invert">
                      <span className="sv-overline" style={{ color: "var(--accent)" }}>
                        Open roles
                      </span>
                      <span className="sv-section-count sv-section-count--light">
                        {String(result.jobs.length).padStart(2, "0")} found
                      </span>
                    </div>
                    <div className="sv-job-list">
                      {result.jobs.map((job, i) => (
                        <article className="sv-job" key={i}>
                          <div className="sv-job-head">
                            <span className="sv-job-index">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <h3 className="sv-job-title">
                              {job.url ? (
                                <a
                                  href={job.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {job.title}
                                </a>
                              ) : (
                                job.title
                              )}
                            </h3>
                            {job.url && (
                              <a
                                className="sv-job-link-arrow"
                                href={job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`View ${job.title}`}
                              >
                                &#8599;
                              </a>
                            )}
                          </div>

                          {(job.department ||
                            job.location ||
                            job.employment_type) && (
                            <div className="sv-job-tags">
                              {job.department && (
                                <span className="sv-tag">{job.department}</span>
                              )}
                              {job.location && (
                                <span className="sv-tag">{job.location}</span>
                              )}
                              {job.employment_type && (
                                <span className="sv-tag">
                                  {job.employment_type}
                                </span>
                              )}
                            </div>
                          )}

                          {job.description && (
                            <p className="sv-job-desc">{job.description}</p>
                          )}
                        </article>
                      ))}
                    </div>
                  </section>
                )}

              {/* Empty state */}
              {result.jobs.length === 0 &&
                !scraping &&
                !healing &&
                !statusPolling &&
                result.company.status !== "discovering" &&
                result.company.status !== "creating_scraper" &&
                result.company.status !== "scraping" && (
                  <section className="sv-state mt-12">
                    <p className="sv-state-label">Result</p>
                    <h2 className="sv-state-title">No open roles.</h2>
                    <p className="sv-state-body">
                      {result.isNew
                        ? "This company has been registered. Start scraping to discover its jobs."
                        : "No active jobs found. Try refreshing the scraper."}
                    </p>
                  </section>
                )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
