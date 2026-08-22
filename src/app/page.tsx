"use client";

import { useState, useCallback, useEffect, useRef } from "react";

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
  discovering: "Discovering company...",
  creating_scraper: "Creating scraper...",
  scraping: "Scraping jobs...",
  validating: "Validating results...",
  healthy: "Scraper healthy",
  suspicious: "Results suspicious",
  broken: "Scraper broken",
  self_healing: "Self-healing in progress...",
  healing_failed: "Healing failed",
  error: "Scrape failed",
};

function StatusBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    healthy: "badge-healthy",
    suspicious: "badge-suspicious",
    broken: "badge-broken",
    self_healing: "badge-healing",
    discovering: "badge-discovering",
    creating_scraper: "badge-discovering",
    scraping: "badge-healing",
    validating: "badge-healing",
    healing_failed: "badge-broken",
    error: "badge-broken",
  };
  return (
    <span className={`badge ${classMap[status] || "badge-default"}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-green-500" : score >= 70 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-32 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm text-neutral-400">{score}/100</span>
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
  const [statusPolling, setStatusPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptRef = useRef(0);

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
        // Stop polling if status is stable (not actively processing)
        const activeStatuses = [
          "discovering",
          "creating_scraper",
          "scraping",
          "self_healing",
        ];
        if (!activeStatuses.includes(data.status)) {
          return true; // stop
        }
      }
    } catch {
      // ignore poll errors
    }
    return false;
  }, []);

  useEffect(() => {
    if (statusPolling && result?.company.id) {
      // Poll immediately, then every 3 seconds
      const MAX_POLL_ATTEMPTS = 40; // ~2 minutes at 3s interval

      const poll = async () => {
        pollAttemptRef.current += 1;

        if (pollAttemptRef.current > MAX_POLL_ATTEMPTS) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStatusPolling(false);
          setError("Scrape is taking longer than expected. Check back shortly.");
          return;
        }

        const shouldStop = await pollStatus(result.company.id);
        if (shouldStop && pollRef.current) {
          clearInterval(pollRef.current);
          setStatusPolling(false);
          // Refresh jobs
          const res = await fetch(`/api/companies/${result.company.id}/jobs`);
          if (res.ok) {
            const data = await res.json();
            setResult((prev) =>
              prev ? { ...prev, jobs: data.jobs } : prev
            );
          }
        }
      };

      // Initial poll
      poll();

      // Set up interval
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

      // API returns immediately - start polling for status updates
      pollAttemptRef.current = 0;
      setStatusPolling(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }, [result?.company.id]);

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-6 h-6 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span className="text-lg font-semibold">Scrape Verse</span>
          </div>
          <a
            href="/admin"
            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Admin
          </a>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* Hero */}
          {!result && (
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-3">
                Self-Healing Careers Scraper
              </h1>
              <p className="text-neutral-400 text-lg">
                Enter a company name. We find their careers page, scrape jobs,
                and automatically repair the scraper when pages change.
              </p>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-3 mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Company name, domain, or URL (e.g. Cursor, hex.tech, https://nozomio.com/careers)"
              disabled={loading}
            />
            <button
              className="btn-primary whitespace-nowrap"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin-slow"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="card p-4 mb-6 border-red-900/50 bg-red-950/30">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-6">
              {/* Company Card */}
              <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold">
                      {result.company.name}
                    </h2>
                    {result.company.domain && (
                      <a
                        href={`https://${result.company.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-400 hover:text-blue-400 text-sm transition-colors"
                      >
                        {result.company.domain}
                      </a>
                    )}
                  </div>
                  <StatusBadge status={result.company.status} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">
                      Careers Page
                    </div>
                    {result.company.careers_url ? (
                      <a
                        href={result.company.careers_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline truncate block"
                      >
                        {result.company.careers_url.replace(
                          /^https?:\/\//,
                          ""
                        )}
                      </a>
                    ) : (
                      <span className="text-sm text-neutral-500">
                        Not found
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">
                      Health Score
                    </div>
                    <HealthBar score={result.company.last_health_score} />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">Jobs</div>
                    <span className="text-sm font-medium">
                      {result.company.last_job_count}
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 mb-1">
                      Last Checked
                    </div>
                    <span className="text-sm">
                      {timeAgo(result.company.last_scrape_at)}
                    </span>
                  </div>
                </div>

                {result.company.scraper_id && (
                  <div className="flex items-center gap-4 text-xs text-neutral-500 mb-4">
                    <span>
                      Scraper:{" "}
                      <code className="text-neutral-400">
                        {result.company.scraper_id}
                      </code>
                    </span>
                    <span>v{result.company.scraper_version}</span>
                    {result.company.healing_attempts > 0 && (
                      <span>
                        Healing attempts: {result.company.healing_attempts}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    className="btn-primary"
                    onClick={handleScrape}
                    disabled={scraping || statusPolling}
                  >
                    {scraping
                      ? "Starting..."
                      : statusPolling
                        ? result.company.status === "self_healing"
                          ? "Healing..."
                          : "Scraping..."
                        : result.isNew
                          ? "Start Scraping"
                          : "Refresh Jobs"}
                  </button>
                  <button
                    className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-800 transition-colors text-sm"
                    onClick={() => {
                      setResult(null);
                      setQuery("");
                    }}
                  >
                    New Search
                  </button>
                </div>
              </div>

              {/* Processing Status */}
              {statusPolling && (
                <div className="card p-4 border-blue-900/50 bg-blue-950/20">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-blue-400 animate-spin-slow"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-blue-300">
                        {result.company.status === "self_healing"
                          ? "Self-healing in progress"
                          : result.company.status === "scraping"
                            ? "Scraping in progress"
                            : result.company.status === "creating_scraper"
                              ? "Creating scraper"
                              : "Processing..."}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {result.company.status === "self_healing"
                          ? "The scraper detected a problem and is automatically repairing itself."
                          : "This page will update automatically when complete."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Jobs List */}
              {result.jobs.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">
                    {result.jobs.length} Jobs Found
                  </h3>
                  <div className="space-y-2">
                    {result.jobs.map((job, i) => (
                      <div
                        key={i}
                        className="card p-4 hover:border-neutral-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h4 className="font-medium truncate">
                              {job.url ? (
                                <a
                                  href={job.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-blue-400 transition-colors"
                                >
                                  {job.title}
                                </a>
                              ) : (
                                job.title
                              )}
                            </h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                              {job.location && (
                                <span className="text-sm text-neutral-400">
                                  {job.location}
                                </span>
                              )}
                              {job.department && (
                                <span className="text-sm text-neutral-500">
                                  {job.department}
                                </span>
                              )}
                              {job.employment_type && (
                                <span className="text-sm text-neutral-500">
                                  {job.employment_type}
                                </span>
                              )}
                            </div>
                          </div>
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:underline whitespace-nowrap"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No jobs state */}
              {result.jobs.length === 0 &&
                !scraping &&
                !statusPolling &&
                result.company.status !== "discovering" &&
                result.company.status !== "creating_scraper" &&
                result.company.status !== "scraping" && (
                  <div className="card p-8 text-center">
                    <p className="text-neutral-400">
                      {result.isNew
                        ? 'Click "Start Scraping" to discover jobs.'
                        : "No active jobs found. Try refreshing."}
                    </p>
                  </div>
                )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
