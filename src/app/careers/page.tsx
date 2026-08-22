import type { Metadata } from "next";
import CareersBoardV2 from "./careers-board-v2";

export const metadata: Metadata = {
  title: "Careers - TechCorp",
};

export default function CareersPage() {
  return <CareersBoardV2 />;
}
