const JOBS = [
  {
    department: "Engineering",
    title: "Senior Full Stack Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$140k - $170k",
    description:
      "Build scalable microservices and React web applications for enterprise clients.",
    applyUrl: "/apply/tc-101-senior-full-stack-engineer",
    pillClass: "tc-pill-eng",
  },
  {
    department: "Data & AI",
    title: "Machine Learning Specialist",
    location: "New York, NY",
    type: "Full-time",
    salary: "$160k - $190k",
    description:
      "Develop and optimize LLM pipelines and predictive data models.",
    applyUrl: "/apply/tc-102-machine-learning-specialist",
    pillClass: "tc-pill-ai",
  },
  {
    department: "Product",
    title: "Lead Product Manager",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$150k - $180k",
    description:
      "Drive the product roadmap for our core cloud infrastructure products.",
    applyUrl: "/apply/tc-103-lead-product-manager",
    pillClass: "tc-pill-product",
  },
  {
    department: "Security",
    title: "DevSecOps Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$135k - $165k",
    description:
      "Implement automated CI/CD security checks and cloud environment compliance.",
    applyUrl: "/apply/tc-104-devsecops-engineer",
    pillClass: "tc-pill-sec",
  },
  {
    department: "Design",
    title: "Principal UX/UI Designer",
    location: "Austin, TX",
    type: "Full-time",
    salary: "$130k - $155k",
    description:
      "Lead user research and shape our design system across all platform products.",
    applyUrl: "/apply/tc-105-principal-uxui-designer",
    pillClass: "tc-pill-design",
  },
];

export default function CareersBoardV1() {
  return (
    <div className="tcb-page">
      <style>{`
        .tcb-page { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: #0f1420; color: #e8ecf4; min-height: 100vh; padding: 48px 20px; }
        .tcb-shell { max-width: 1080px; margin: 0 auto; }
        .tcb-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; }
        .tcb-brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; }
        .tcb-brand-dot { width: 12px; height: 12px; border-radius: 3px; background: #5eead4; }
        .tcb-topbar small { color: #8b94a7; font-size: 13px; }
        .tcb-title { font-size: 30px; margin-bottom: 6px; color: #ffffff; }
        .tcb-sub { color: #8b94a7; margin-bottom: 28px; }
        .tcb-table-wrap { overflow-x: auto; border: 1px solid #232b3d; border-radius: 10px; background: #141a2a; }
        .tcb-table { width: 100%; border-collapse: collapse; }
        .tcb-thead th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: 1.4px; color: #7c8699; padding: 14px 16px; border-bottom: 1px solid #232b3d; background: #101624; }
        .tcb-row { border-bottom: 1px solid #1d2436; }
        .tcb-row:last-child { border-bottom: none; }
        .tcb-row:hover { background: #182034; }
        .tcb-cell { padding: 16px; vertical-align: top; }
        .tcb-role-name { font-size: 16.5px; font-weight: 600; color: #ffffff; margin: 0; }
        .tcb-role-summary { font-size: 13.5px; color: #98a2b5; margin-top: 5px; line-height: 1.55; max-width: 380px; }
        .tcb-pill { display: inline-block; font-size: 12px; padding: 4px 11px; border-radius: 999px; white-space: nowrap; }
        .tc-pill-eng { background: rgba(94,234,212,0.12); color: #5eead4; }
        .tc-pill-ai { background: rgba(167,139,250,0.14); color: #a78bfa; }
        .tc-pill-product { background: rgba(251,191,36,0.12); color: #fbbf24; }
        .tc-pill-sec { background: rgba(248,113,113,0.12); color: #f87171; }
        .tc-pill-design { background: rgba(96,165,250,0.12); color: #60a5fa; }
        .tcb-loc { font-size: 13.5px; color: #aab3c5; white-space: nowrap; }
        .tcb-type { font-size: 12.5px; color: #7c8699; margin-top: 4px; }
        .tcb-pay { font-size: 14px; color: #d7dde9; white-space: nowrap; }
        .tcb-apply { display: inline-block; font-size: 13px; font-weight: 600; color: #0f1420; background: #5eead4; padding: 8px 16px; border-radius: 6px; text-decoration: none; white-space: nowrap; }
        .tcb-apply:hover { background: #86f0de; }
        .tcb-foot { margin-top: 26px; font-size: 12.5px; color: #5f6880; }
      `}</style>
      <div className="tcb-shell">
        <nav className="tcb-topbar">
          <div className="tcb-brand">
            <span className="tcb-brand-dot" />
            TechCorp
          </div>
          <small>careers board · v1</small>
        </nav>

        <h1 className="tcb-title">Open Roles</h1>
        <p className="tcb-sub">
          We are hiring across five teams. Pick a row and come build with us.
        </p>

        <div className="tcb-table-wrap">
          <table className="tcb-table" id="roles-board">
            <thead>
              <tr>
                <th>Role</th>
                <th>Team</th>
                <th>Location</th>
                <th>Compensation</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {JOBS.map((job) => (
                <tr className="tcb-role-row tcb-row" key={job.applyUrl}>
                  <td className="tcb-cell">
                    <h2 className="tcb-role-name">{job.title}</h2>
                    <p className="tcb-role-summary">{job.description}</p>
                  </td>
                  <td className="tcb-cell">
                    <span className={`tcb-pill ${job.pillClass}`}>
                      {job.department}
                    </span>
                  </td>
                  <td className="tcb-cell">
                    <div className="tcb-loc">{job.location}</div>
                    <div className="tcb-type">{job.type}</div>
                  </td>
                  <td className="tcb-cell">
                    <span className="tcb-pay">{job.salary}</span>
                  </td>
                  <td className="tcb-cell">
                    <a className="tcb-apply" href={job.applyUrl}>
                      Apply
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="tcb-foot">
          Structure V1 — table rows. TechCorp is an equal opportunity employer.
        </footer>
      </div>
    </div>
  );
}
