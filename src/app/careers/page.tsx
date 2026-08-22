import type { Metadata } from "next";
import CareersBoardV1 from "./careers-board-v1";

export const metadata: Metadata = {
  title: "Careers - TechCorp",
};

export default function CareersPage() {
  return <CareersBoardV1 />;
}
