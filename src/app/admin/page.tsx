"use client";

import { useState, useCallback } from "react";

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
    <div className="flex flex-col flex-1">
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold">Admin / Debug</span>
          <a
            href="/"
            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            Back to App
          </a>
        </div>
      </header>

      <main className="flex-1 px-6 py-8">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Company Lookup */}
          <section className="card p-6">
            <h2 className="text-lg font-semibold mb-4">Company Lookup</h2>
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchStatus()}
                placeholder="Company UUID"
              />
              <button
                className="btn-primary whitespace-nowrap"
                onClick={fetchStatus}
                disabled={loading}
              >
                {loading ? "Loading..." : "Fetch Status"}
              </button>
            </div>

            {status && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <InfoBox label="Status" value={status.status} />
                  <InfoBox label="Health Score" value={`${status.healthScore}/100`} />
                  <InfoBox label="Jobs" value={String(status.jobCount)} />
                  <InfoBox label="Scraper Version" value={`v${status.scraperVersion}`} />
                  <InfoBox label="Scraper ID" value={status.scraperId || "-"} />
                  <InfoBox label="Healing Attempts" value={String(status.healingAttempts)} />
                  <InfoBox label="Last Scrape" value={fmtDate(status.lastScrape)} />
                </div>

                {/* Scraper Runs */}
                {status.runs.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-neutral-300">
                      Scraper Runs
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-neutral-500 border-b border-neutral-800">
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4">Jobs</th>
                            <th className="py-2 pr-4">Health</th>
                            <th className="py-2 pr-4">Reason</th>
                            <th className="py-2 pr-4">Started</th>
                            <th className="py-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {status.runs.map((run) => (
                            <tr key={run.id} className="border-b border-neutral-800/50">
                              <td className="py-2 pr-4">{run.status}</td>
                              <td className="py-2 pr-4">{run.result_count}</td>
                              <td className="py-2 pr-4">{run.health_score}</td>
                              <td className="py-2 pr-4 text-neutral-400 max-w-xs truncate">
                                {run.failure_reason || "-"}
                              </td>
                              <td className="py-2 pr-4">{fmtDate(run.started_at)}</td>
                              <td className="py-2">{duration(run.started_at, run.completed_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Healing Runs */}
                {status.healingRuns.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 text-neutral-300">
                      Healing Runs
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-neutral-500 border-b border-neutral-800">
                            <th className="py-2 pr-4">Status</th>
                            <th className="py-2 pr-4">Reason</th>
                            <th className="py-2 pr-4">Version</th>
                            <th className="py-2 pr-4">Error</th>
                            <th className="py-2 pr-4">Started</th>
                            <th className="py-2">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {status.healingRuns.map((hr) => (
                            <tr key={hr.id} className="border-b border-neutral-800/50">
                              <td className="py-2 pr-4">{hr.status}</td>
                              <td className="py-2 pr-4 max-w-xs truncate">{hr.trigger_reason}</td>
                              <td className="py-2 pr-4">
                                v{hr.old_version}
                                {hr.new_version ? ` -> v${hr.new_version}` : ""}
                              </td>
                              <td className="py-2 pr-4 text-red-400 max-w-xs truncate">
                                {hr.error || "-"}
                              </td>
                              <td className="py-2 pr-4">{fmtDate(hr.started_at)}</td>
                              <td className="py-2">{duration(hr.started_at, hr.completed_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Test Scenarios */}
          <section className="card p-6">
            <h2 className="text-lg font-semibold mb-2">Test Scenarios</h2>
            <p className="text-sm text-neutral-400 mb-4">
              Run simulated scraper scenarios to test health scoring and
              orchestration logic without hitting real APIs.
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: "success", label: "A: 100 Jobs (Healthy)" },
                { key: "zero_jobs", label: "B: 0 Jobs (Broken)" },
                { key: "malformed", label: "C: Malformed Data" },
                { key: "missing_fields", label: "D: Missing Fields" },
                { key: "healed", label: "E: Healed (Success)" },
              ].map((s) => (
                <button
                  key={s.key}
                  className="px-3 py-1.5 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800 transition-colors"
                  onClick={() => runTest(s.key)}
                  disabled={testLoading}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {testResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">
                    Scenario: {testResult.scenario}
                  </span>
                  <span className="text-sm">
                    Jobs: {testResult.jobCount}
                  </span>
                  <span
                    className={`badge ${
                      testResult.health.status === "healthy"
                        ? "badge-healthy"
                        : testResult.health.status === "suspicious"
                          ? "badge-suspicious"
                          : "badge-broken"
                    }`}
                  >
                    {testResult.health.status} ({testResult.health.score}/100)
                  </span>
                </div>
                <div className="space-y-1">
                  {testResult.health.checks.map((c) => (
                    <div
                      key={c.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={c.passed ? "text-green-400" : "text-red-400"}
                      >
                        {c.passed ? "PASS" : "FAIL"}
                      </span>
                      <span className="text-neutral-500 w-40">{c.name}</span>
                      <span className="text-neutral-400">{c.detail}</span>
                      <span className="text-neutral-600">(w:{c.weight})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-sm font-mono truncate">{value}</div>
    </div>
  );
}
