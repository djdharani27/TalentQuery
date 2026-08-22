import { NextRequest, NextResponse } from "next/server";
import { getCompanyJobs } from "@/lib/scraper/orchestrator";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const jobs = await getCompanyJobs(id);
    return NextResponse.json({ jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
