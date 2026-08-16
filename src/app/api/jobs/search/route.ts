import { NextRequest, NextResponse } from "next/server";

type ApifyJob = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  viewJobUrl?: string;
  applyUrl?: string;
  salary?: { text?: string } | string;
  postedRelative?: string;
};

export async function POST(request: NextRequest) {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_INDEED_ACTOR_ID || "schnellscrapers~indeed-jobs-scraper";

  if (!token) {
    return NextResponse.json({ error: "APIFY_API_TOKEN is not configured yet." }, { status: 503 });
  }

  const body = await request.json() as { roles?: string; locations?: string; keywords?: string };
  const queries = [body.roles, body.keywords].filter(Boolean).join(" ").trim();
  const location = body.locations?.split(",")[0]?.trim();

  if (!queries || !location) {
    return NextResponse.json({ error: "Target roles and a location are required." }, { status: 400 });
  }

  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ searches: [{ query: queries, location, country: "US" }], maxRecords: 20, maxPagesPerSearch: 1 }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: `Apify returned ${response.status}. Check the Actor ID and input schema.` }, { status: 502 });
  }

  const items = await response.json() as ApifyJob[];
  const jobs = items.map((job) => ({ title: job.title || "Untitled role", company: job.company || "Unknown company", location: job.location || location, description: job.description || "", url: job.viewJobUrl || job.applyUrl || "", salary: typeof job.salary === "string" ? job.salary : job.salary?.text || null, posted: job.postedRelative || null }));
  return NextResponse.json({ jobs });
}
