"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

interface CompanyStatus {
  status: string;
  healthScore: number;
  lastScrape: string | null;
  jobCount: number;
  healingAttempts: number;
  scraperId: string | null;
  scraperVersion: number;
  runs: ScraperRun[];
  healingRuns: HealingRun[];
}

interface ScraperRun {
  id: string;
  status: string;
  result_count: number;
  health_score: number;
  validation_status: string;
  failure_reason: string | null;
  started_at: string;
  completed_at: string | null;
}

interface HealingRun {
  id: string;
  trigger_reason: string;
  old_version: number;
  new_version: number | null;
  status: string;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface TestScenario {
  scenario: string;
  jobCount: number;
  health: {
    score: number;
    status: string;
    checks: { name: string; passed: boolean; detail: string; weight: number }[];
  };
}

export default function AdminPage() {
  const [companyId, setCompanyId] = useState("");
  const [status, setStatus] = useState<CompanyStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestScenario | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!companyId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/status`);
      if (res.ok) {
        setStatus(await res.json());
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [companyId]);

  const runTest = useCallback(async (scenario: string) => {
    setTestLoading(true);
    try {
      const res = await fetch(`/api/dev/test-scenarios?scenario=${scenario}`);
      if (res.ok) {
        setTestResult(await res.json());
      }
    } catch {
      // ignore
    }
    setTestLoading(false);
  }, []);

  const fmtDate = (s: string | null) =>
    s ? new Date(s).toLocaleString() : "-";

  const duration = (start: string, end: string | null) => {
    if (!end) return "running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="flex flex-col flex-1 sv-bg-grid">
      <header className="sv-header">
        <div className="sv-header-inner">
          <Link href="/" className="sv-brand">
            <span className="sv-brand-mark">SV</span>
            <span className="sv-brand-name">
              Admin<span>/</span>Debug
            </span>
          </Link>
          <nav className="sv-nav">
            <Link href="/" className="sv-nav-link">
              Careers
            </Link>
            <Link href="/admin" className="sv-nav-link is-active">
              Admin
            </Link>
          </nav>
        </div>
      </header>

      <main className="sv-main">
        <div className="sv-container">
          <p className="sv-overline mb-4">Admin / Debug</p>

          <div className="flex flex-col gap-10">
            {/* Company Lookup */}
            <section className="sv-panel">
              <div className="sv-panel-head">
                <span className="sv-panel-title">Company Lookup</span>
              </div>
              <div className="sv-panel-body">
                <div className="sv-search">
                  <div className="sv-search-row">
                    <span className="sv-search-prefix" aria-hidden="true">
                      #
                    </span>
                    <input
                      className="sv-input"
                      type="text"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && fetchStatus()}
                      placeholder="Company UUID"
                    />
                  </div>
                  <button
                    className="sv-btn sv-btn--primary sv-btn--block"
                    onClick={fetchStatus}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="sv-inline-loading">
                        <span className="sv-spinner" />
                        Loading
                      </span>
                    ) : (
                      "Fetch Status"
                    )}
                  </button>
                </div>

                {status && (
                  <div className="mt-8">
                    <div className="sv-grid">
                      <InfoBox label="Status" value={status.status} />
                      <InfoBox
                        label="Health Score"
                        value={`${status.healthScore}/100`}
                      />
                      <InfoBox label="Jobs" value={String(status.jobCount)} />
                      <InfoBox
                        label="Scraper Version"
                        value={`v${status.scraperVersion}`}
                      />
                      <InfoBox
                        label="Scraper ID"
                        value={status.scraperId || "-"}
                      />
                      <InfoBox
                        label="Healing Attempts"
                        value={String(status.healingAttempts)}
                      />
                      <InfoBox
                        label="Last Scrape"
                        value={fmtDate(status.lastScrape)}
                      />
                    </div>

                    {status.runs.length > 0 && (
                      <div className="mt-8">
                        <h3 className="sv-overline mb-3">Scraper Runs</h3>
                        <div className="sv-table-wrap">
                          <table className="sv-table">
                            <thead>
                              <tr>
                                <th>Status</th>
                                <th>Jobs</th>
                                <th>Health</th>
                                <th>Reason</th>
                                <th>Started</th>
                                <th>Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {status.runs.map((run) => (
                                <tr key={run.id}>
                                  <td>{run.status}</td>
                                  <td>{run.result_count}</td>
                                  <td>{run.health_score}</td>
                                  <td
                                    className="sv-mono"
                                    style={{
                                      color: "var(--ink-2)",
                                      maxWidth: 260,
                                    }}
                                  >
                                    {run.failure_reason || "-"}
                                  </td>
                                  <td>{fmtDate(run.started_at)}</td>
                                  <td>
                                    {duration(run.started_at, run.completed_at)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {status.healingRuns.length > 0 && (
                      <div className="mt-8">
                        <h3 className="sv-overline mb-3">Healing Runs</h3>
                        <div className="sv-table-wrap">
                          <table className="sv-table">
                            <thead>
                              <tr>
                                <th>Status</th>
                                <th>Reason</th>
                                <th>Version</th>
                                <th>Error</th>
                                <th>Started</th>
                                <th>Duration</th>
                              </tr>
                            </thead>
                            <tbody>
                              {status.healingRuns.map((hr) => (
                                <tr key={hr.id}>
                                  <td>{hr.status}</td>
                                  <td
                                    className="sv-mono"
                                    style={{
                                      color: "var(--ink-2)",
                                      maxWidth: 260,
                                    }}
                                  >
                                    {hr.trigger_reason}
                                  </td>
                                  <td>
                                    v{hr.old_version}
                                    {hr.new_version
                                      ? ` -> v${hr.new_version}`
                                      : ""}
                                  </td>
                                  <td
                                    className="sv-mono"
                                    style={{
                                      color: "var(--accent)",
                                      maxWidth: 260,
                                    }}
                                  >
                                    {hr.error || "-"}
                                  </td>
                                  <td>{fmtDate(hr.started_at)}</td>
                                  <td>
                                    {duration(hr.started_at, hr.completed_at)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Test Scenarios */}
            <section className="sv-panel">
              <div className="sv-panel-head">
                <span className="sv-panel-title">Test Scenarios</span>
              </div>
              <div className="sv-panel-body">
                <p
                  className="sv-lede mb-5"
                  style={{ fontSize: 14, color: "var(--ink-2)" }}
                >
                  Run simulated scraper scenarios to test health scoring and
                  orchestration logic without hitting real APIs.
                </p>
                <div className="flex flex-wrap gap-3 mb-6">
                  {[
                    { key: "success", label: "A: 100 Jobs (Healthy)" },
                    { key: "zero_jobs", label: "B: 0 Jobs (Broken)" },
                    { key: "malformed", label: "C: Malformed Data" },
                    { key: "missing_fields", label: "D: Missing Fields" },
                    { key: "healed", label: "E: Healed (Success)" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      className="sv-btn"
                      onClick={() => runTest(s.key)}
                      disabled={testLoading}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {testResult && (
                  <div className="sv-state">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="sv-overline">
                        Scenario: {testResult.scenario}
                      </span>
                      <span className="sv-mono text-sm">
                        Jobs: {testResult.jobCount}
                      </span>
                      <span
                        className={`sv-badge ${
                          testResult.health.status === "healthy"
                            ? "sv-badge--healthy"
                            : testResult.health.status === "suspicious"
                              ? "sv-badge--suspicious"
                              : "sv-badge--broken"
                        }`}
                      >
                        {testResult.health.status} ({testResult.health.score}
                        /100)
                      </span>
                    </div>
                    <div className="mt-5 flex flex-col gap-2">
                      {testResult.health.checks.map((c) => (
                        <div
                          key={c.name}
                          className="sv-mono flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
                        >
                          <span
                            style={{
                              color: c.passed
                                ? "var(--ink)"
                                : "var(--accent)",
                              fontWeight: 700,
                            }}
                          >
                            {c.passed ? "PASS" : "FAIL"}
                          </span>
                          <span
                            style={{
                              color: "var(--ink-2)",
                              width: 160,
                            }}
                          >
                            {c.name}
                          </span>
                          <span style={{ color: "var(--ink-3)" }}>
                            {c.detail}
                          </span>
                          <span style={{ color: "var(--ink-3)" }}>
                            (w:{c.weight})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="sv-footer">
        <div className="sv-footer-inner">
          <span>Scrape/Verse</span>
          <span>Admin / Debug</span>
        </div>
      </footer>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="sv-grid-item">
      <div className="sv-grid-key">{label}</div>
      <div className="sv-grid-value">{value}</div>
    </div>
  );
}
