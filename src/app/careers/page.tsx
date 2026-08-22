import type { Metadata } from "next";
import CareersBoard from "./careers-board";

export const metadata: Metadata = {
  title: "Careers - TechCorp",
  description: "Open positions at TechCorp across engineering, AI, product, security, and design.",
};

export default function CareersPage() {
  return <CareersBoard />;
}
