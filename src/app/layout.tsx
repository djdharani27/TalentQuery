import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scrape Verse - Self-Healing Careers Scraper",
  description:
    "Automatically discover and scrape company career pages with self-healing AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
