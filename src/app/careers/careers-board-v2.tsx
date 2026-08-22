"use client";

import { useState } from "react";

const DEPARTMENTS = [
  {
    department: "Engineering",
    jobs: [
      {
        title: "Senior Full Stack Engineer",
        place: "Remote",
        type: "Full-time",
        salary: "$140k – $170k",
        blurb:
          "Build scalable microservices and React web applications for enterprise clients.",
        applyUrl: "/jobs/tc-101-senior-full-stack-engineer",
      },
    ],
  },
  {
    department: "Data & AI",
    jobs: [
      {
        title: "Machine Learning Specialist",
        place: "New York, NY",
        type: "Full-time",
        salary: "$160k – $190k",
        blurb:
          "Develop and optimize LLM pipelines and predictive data models.",
        applyUrl: "/jobs/tc-102-machine-learning-specialist",
      },
    ],
  },
  {
    department: "Product",
    jobs: [
      {
        title: "Lead Product Manager",
        place: "San Francisco, CA",
        type: "Full-time",
        salary: "$150k – $180k",
        blurb:
          "Drive the product roadmap for our core cloud infrastructure products.",
        applyUrl: "/jobs/tc-103-lead-product-manager",
      },
    ],
  },
  {
    department: "Security",
    jobs: [
      {
        title: "DevSecOps Engineer",
        place: "Remote",
        type: "Full-time",
        salary: "$135k – $165k",
        blurb:
          "Implement automated CI/CD security checks and cloud environment compliance.",
        applyUrl: "/jobs/tc-104-devsecops-engineer",
      },
    ],
  },
  {
    department: "Design",
    jobs: [
      {
        title: "Principal UX/UI Designer",
        place: "Austin, TX",
        type: "Full-time",
        salary: "$130k – $155k",
        blurb:
          "Lead user research and shape our design system across all platform products.",
        applyUrl: "/jobs/tc-105-principal-uxui-designer",
      },
    ],
  },
];

export default function CareersBoardV2() {
  const [openDept, setOpenDept] = useState<string | null>("Engineering");

  return (
    <div className="tcv-page">
      <style>{`
        .tcv-page { font-family: Georgia, "Times New Roman", serif; background: #faf7f2; color: #23201c; min-height: 100vh; padding: 56px 24px; }
        .tcv-container { max-width: 760px; margin: 0 auto; }
        .tcv-masthead { text-align: center; margin-bottom: 44px; }
        .tcv-logo { display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 50%; background: #23201c; color: #faf7f2; font-size: 18px; margin-bottom: 14px; }
        .tcv-heading { font-size: 36px; font-weight: normal; letter-spacing: 0.5px; margin: 0; }
        .tcv-tagline { font-style: italic; color: #7a7367; margin-top: 8px; }
        .tcv-group { margin-bottom: 30px; }
        .tcv-group > h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 3px; color: #9c5228; border-bottom: 2px solid #e5ddcf; padding-bottom: 8px; margin-bottom: 14px; }
        .tcv-vacancy { background: #ffffff; border: 1px solid #e5ddcf; border-radius: 8px; margin-bottom: 10px; overflow: hidden; cursor: pointer; }
        .tcv-summary { padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
        .tcv-vacancy[data-open="true"] .tcv-summary { border-bottom: 1px dashed #e5ddcf; }
        .tcv-name { font-size: 19px; }
        .tcv-place { font-size: 13px; color: #7a7367; font-style: italic; margin-top: 2px; }
        .tcv-chev { font-size: 12px; color: #b0a689; }
        .tcv-body { padding: 18px 20px 22px; }
        .tcv-blurb { font-size: 15px; line-height: 1.65; color: #4a443b; margin-bottom: 14px; }
        .tcv-facts span { display: inline-block; font-size: 12.5px; background: #f1eadd; color: #6b5d43; border-radius: 4px; padding: 4px 10px; margin-right: 8px; margin-bottom: 6px; }
        .tcv-cta { display: inline-block; margin-top: 12px; font-size: 14px; color: #9c5228; border-bottom: 1px solid #9c5228; text-decoration: none; padding-bottom: 2px; }
        .tcv-cta:hover { color: #6f3a1c; border-color: #6f3a1c; }
        .tcv-colophon { text-align: center; font-size: 12px; color: #a39a89; margin-top: 40px; font-style: italic; }
      `}</style>
      <div className="tcv-container">
        <header className="tcv-masthead">
          <span className="tcv-logo">TC</span>
          <h1 className="tcv-heading">Vacancies at TechCorp</h1>
          <p className="tcv-tagline">Five teams. One mission. Endless curiosity.</p>
        </header>

        {DEPARTMENTS.map((group) => {
          const isOpen = openDept === group.department;
          return (
            <section
              className="tcv-group"
              data-department={group.department}
              key={group.department}
            >
              <h2>{group.department}</h2>
              {group.jobs.map((job) => (
                <article
                  className="tcv-vacancy"
                  data-open={isOpen}
                  key={job.applyUrl}
                  data-job-row
                  data-job-department={group.department}
                  onClick={() =>
                    setOpenDept(isOpen ? null : group.department)
                  }
                >
                  <div className="tcv-summary">
                    <div>
                      <div className="tcv-name" data-job-title>
                        {job.title}
                      </div>
                      <div className="tcv-place" data-job-location>
                        {job.place}
                      </div>
                    </div>
                    <span className="tcv-chev">{isOpen ? "▲" : "▼"}</span>
                  </div>
                  {isOpen && (
                    <div className="tcv-body" onClick={(e) => e.stopPropagation()}>
                      <p className="tcv-blurb" data-job-description>
                        {job.blurb}
                      </p>
                      <div className="tcv-facts">
                        <span data-job-type>{job.type}</span>
                        <span data-job-salary>{job.salary}</span>
                      </div>
                      <br />
                      <a
                        className="tcv-cta"
                        href={job.applyUrl}
                        data-job-url
                      >
                        Submit application →
                      </a>
                    </div>
                  )}
                </article>
              ))}
            </section>
          );
        })}

        <footer className="tcv-colophon">
          Structure V2 — accordion grouped by department. TechCorp is an equal
          opportunity employer.
        </footer>
      </div>
    </div>
  );
}
