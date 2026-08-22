"use client";

import { useState } from "react";
import styles from "./careers.module.css";

interface Job {
  department: string;
  title: string;
  details: string;
  description: string;
}

const JOBS: Job[] = [
  {
    department: "Engineering",
    title: "Senior Full Stack Engineer",
    details: "Remote • Full-time • $140k - $170k",
    description:
      "Build scalable microservices and React web applications for enterprise clients.",
  },
  {
    department: "Data & AI",
    title: "Machine Learning Specialist",
    details: "New York, NY • Full-time • $160k - $190k",
    description:
      "Develop and optimize LLM pipelines and predictive data models.",
  },
  {
    department: "Product",
    title: "Lead Product Manager",
    details: "San Francisco, CA • Full-time • $150k - $180k",
    description:
      "Drive the product roadmap for our core cloud infrastructure products.",
  },
  {
    department: "Security",
    title: "DevSecOps Engineer",
    details: "Remote • Full-time • $135k - $165k",
    description:
      "Implement automated CI/CD security checks and cloud environment compliance.",
  },
  {
    department: "Design",
    title: "Principal UX/UI Designer",
    details: "Austin, TX • Full-time • $130k - $155k",
    description:
      "Lead user research and shape our design system across all platform products.",
  },
];

export default function CareersBoard() {
  const [listView, setListView] = useState(false);

  const pick = (gridClass: string, listClass: string) =>
    listView ? styles[listClass] : styles[gridClass];

  return (
    <div className={`${styles.page} ${listView ? styles.dark : ""}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>Open Positions</h1>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={() => setListView((v) => !v)}
        >
          Change Structure
        </button>
      </header>

      <main className={listView ? styles.list : styles.grid}>
        {JOBS.map((job) => (
          <article
            key={job.title}
            className={listView ? styles.row : styles.card}
          >
            <div className={listView ? styles.rowLeft : undefined}>
              <div className={pick("cardDept", "rowDept")}>{job.department}</div>
              <h2 className={pick("cardTitle", "rowTitle")}>{job.title}</h2>
              <div className={pick("cardDetails", "rowDetails")}>
                {job.details}
              </div>
              <p className={pick("cardDesc", "rowDesc")}>{job.description}</p>
            </div>
            <a href="#apply" className={pick("cardLink", "rowLink")}>
              Apply Now
            </a>
          </article>
        ))}
      </main>
    </div>
  );
}
