import { NextRequest, NextResponse } from "next/server";
import { dedupeJobs } from "@/lib/jobs/dedupe";
import { normalizeJobs } from "@/lib/jobs/normalize";
import { prisma } from "@/lib/db";
import { analyzeJobWithLLM, passesHardFilters } from "@/lib/jobs/analyze";

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

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  console.info("[job-search] started");
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_INDEED_ACTOR_ID || "schnellscrapers~indeed-jobs-scraper";

  if (!token) {
    return NextResponse.json({ error: "APIFY_API_TOKEN is not configured yet." }, { status: 503 });
  }

  const body = await request.json() as { roles?: string; locations?: string; keywords?: string; workMode?: string; minimumSalary?: string };
  const queries = [body.roles, body.keywords].filter(Boolean).join(" ").trim();
  const location = body.locations?.split(",")[0]?.trim();

  if (!queries || !location) {
    return NextResponse.json({ error: "Target roles and a location are required." }, { status: 400 });
  }

  const response = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ searches: [{ query: queries, location, country: "US" }], maxRecords: 10, maxPagesPerSearch: 1 }),
  });
  console.info(`[job-search] Apify completed in ${Date.now() - startedAt}ms`);

  if (!response.ok) {
    return NextResponse.json({ error: `Apify returned ${response.status}. Check the Actor ID and input schema.` }, { status: 502 });
  }

  const items = await response.json() as ApifyJob[];
  const jobs = dedupeJobs(normalizeJobs(items));
  console.info(`[job-search] normalized ${jobs.length} jobs`);

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ jobs, storage: "not_configured", error: "Jobs were fetched but not saved. DATABASE_URL is not configured." });
  }

  const user = await prisma.user.upsert({ where: { email: "demo@personal-assistant.local" }, update: {}, create: { email: "demo@personal-assistant.local" } });
  const profile = {
    targetRoles: body.roles?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    skills: body.keywords?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    searchKeywords: body.keywords?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    preferredLocations: body.locations?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    workModes: body.workMode ? [body.workMode] : [],
    minimumSalary: Number.parseInt(body.minimumSalary?.replace(/[^0-9]/g, "") || "", 10) || null,
  };
  await prisma.candidateProfile.upsert({ where: { userId: user.id }, update: profile, create: { userId: user.id, ...profile } });
  const eligibleJobs = jobs.filter((job) => passesHardFilters(profile, job));
  console.info(`[job-search] ${eligibleJobs.length} jobs passed hard filters`);
  const rankedJobs = await Promise.all(eligibleJobs.map(async (job) => {
    const existing = job.url ? await prisma.job.findFirst({ where: { userId: user.id, url: job.url } }) : null;
    let savedJob;
    if (existing) {
      savedJob = await prisma.job.update({ where: { id: existing.id }, data: { company: job.company, role: job.title, description: job.description, salary: job.salary, location: job.location, source: job.source, postedAt: job.postedAt } });
    } else {
      savedJob = await prisma.job.create({ data: { userId: user.id, company: job.company, role: job.title, description: job.description, salary: job.salary, location: job.location, url: job.url || null, source: job.source, postedAt: job.postedAt } });
    }
    const analysis = await analyzeJobWithLLM(profile, savedJob);
    await prisma.jobAnalysis.upsert({ where: { jobId: savedJob.id }, update: analysis, create: { jobId: savedJob.id, ...analysis } });
    return { ...job, id: savedJob.id, analysis };
  }));

  rankedJobs.sort((a, b) => b.analysis.matchScore - a.analysis.matchScore);
  console.info(`[job-search] completed in ${Date.now() - startedAt}ms`);
  return NextResponse.json({ jobs: rankedJobs, storage: "saved" });
}
