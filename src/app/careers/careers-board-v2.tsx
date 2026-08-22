"use client";

const OPEN_POSITIONS = [
  {
    department: "Engineering",
    title: "Senior Full Stack Engineer",
    location: "Remote",
    type: "Full-time",
    salary: "$140k - $170k",
    description:
      "Build scalable microservices and React web applications for enterprise clients.",
    applyUrl: "/apply/tc-101-senior-full-stack-engineer",
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
  },
];

export default function CareersBoardV2() {
  return (
    <main className="career-page-v2">
      <style>{`
        .career-page-v2 {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172033;
          font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          padding: 52px 24px 70px;
        }

        .career-container-v2 {
          width: 100%;
          max-width: 1120px;
          margin: 0 auto;
        }

        .career-header-v2 {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 30px;
          margin-bottom: 42px;
        }

        .career-brand-v2 {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
        }

        .career-mark-v2 {
          width: 38px;
          height: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          background: #172033;
          color: #ffffff;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        .career-company-v2 {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.2px;
        }

        .career-header-left-v2 h1 {
          margin: 0;
          font-size: 38px;
          line-height: 1.15;
          letter-spacing: -1.2px;
          color: #111827;
        }

        .career-header-left-v2 p {
          max-width: 620px;
          margin: 12px 0 0;
          color: #687386;
          font-size: 15px;
          line-height: 1.7;
        }

        .career-count-v2 {
          flex-shrink: 0;
          margin-top: 62px;
          padding: 10px 15px;
          border: 1px solid #dce2eb;
          border-radius: 8px;
          background: #ffffff;
          color: #667085;
          font-size: 13px;
          font-weight: 600;
        }

        .positions-v2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .position-card-v2 {
          display: flex;
          flex-direction: column;
          min-height: 285px;
          padding: 24px;
          border: 1px solid #dfe4ec;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(23, 32, 51, 0.035);
          transition:
            transform 0.18s ease,
            box-shadow 0.18s ease,
            border-color 0.18s ease;
        }

        .position-card-v2:hover {
          transform: translateY(-2px);
          border-color: #cbd4e2;
          box-shadow: 0 10px 25px rgba(23, 32, 51, 0.08);
        }

        .position-top-v2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .position-department-v2 {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          background: #eef2ff;
          color: #4f46e5;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .position-number-v2 {
          color: #a0a8b7;
          font-size: 12px;
          font-weight: 600;
        }

        .position-main-v2 {
          flex: 1;
        }

        .position-title-v2 {
          margin: 0;
          color: #111827;
          font-size: 20px;
          line-height: 1.35;
          letter-spacing: -0.35px;
        }

        .position-description-v2 {
          margin: 10px 0 0;
          color: #697586;
          font-size: 14px;
          line-height: 1.65;
        }

        .position-details-v2 {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }

        .position-detail-v2 {
          padding: 6px 9px;
          border-radius: 6px;
          background: #f5f7fa;
          color: #596579;
          font-size: 12px;
          border: 1px solid #e8ebf0;
        }

        .position-footer-v2 {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 24px;
          padding-top: 18px;
          border-top: 1px solid #edf0f4;
        }

        .position-salary-v2 {
          color: #374151;
          font-size: 13px;
          font-weight: 600;
        }

        .position-link-v2 {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 14px;
          border-radius: 7px;
          background: #172033;
          color: #ffffff;
          font-size: 12.5px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.18s ease;
        }

        .position-link-v2:hover {
          background: #2b3852;
        }

        .career-footer-v2 {
          margin-top: 36px;
          padding-top: 22px;
          border-top: 1px solid #dfe4ec;
          color: #8a94a5;
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 760px) {
          .career-page-v2 {
            padding: 35px 16px 50px;
          }

          .career-header-v2 {
            flex-direction: column;
            margin-bottom: 30px;
          }

          .career-header-left-v2 h1 {
            font-size: 32px;
          }

          .career-count-v2 {
            margin-top: 0;
          }

          .positions-v2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="career-container-v2">
        <header className="career-header-v2">
          <div className="career-header-left-v2">
            <div className="career-brand-v2">
              <span className="career-mark-v2">TC</span>
              <span className="career-company-v2">TechCorp</span>
            </div>

            <h1>Build what comes next.</h1>

            <p>
              Join our team and help build products used by ambitious
              organizations around the world. Explore our current opportunities
              below.
            </p>
          </div>

          <div className="career-count-v2">
            {OPEN_POSITIONS.length} open positions
          </div>
        </header>

        <section className="positions-v2">
          {OPEN_POSITIONS.map((job, index) => (
            <article
              className="position-card-v2"
              key={job.applyUrl}
            >
              <div className="position-top-v2">
                <span className="position-department-v2">
                  {job.department}
                </span>

                <span className="position-number-v2">
                  0{index + 1}
                </span>
              </div>

              <div className="position-main-v2">
                <h2 className="position-title-v2">
                  {job.title}
                </h2>

                <p className="position-description-v2">
                  {job.description}
                </p>

                <div className="position-details-v2">
                  <span className="position-detail-v2">
                    {job.location}
                  </span>

                  <span className="position-detail-v2">
                    {job.type}
                  </span>
                </div>
              </div>

              <div className="position-footer-v2">
                <span className="position-salary-v2">
                  {job.salary}
                </span>

                <a
                  className="position-link-v2"
                  href={job.applyUrl}
                >
                  View role
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </section>

        <footer className="career-footer-v2">
          TechCorp Careers · We are an equal opportunity employer.
        </footer>
      </div>
    </main>
  );
}
