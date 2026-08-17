import { NextRequest, NextResponse } from "next/server";
import { dedupeJobs } from "@/lib/jobs/dedupe";
import { normalizeJobs } from "@/lib/jobs/normalize";
import { prisma } from "@/lib/db";
import { analyzeJob, analyzeJobWithLLM, passesHardFilters } from "@/lib/jobs/analyze";

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
const APIFY_TIMEOUT_MS = 45_000;

function shouldUseDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return false;

  try {
    const url = new URL(databaseUrl);
    return !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return true;
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  console.info("[job-search] started");
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env.APIFY_INDEED_ACTOR_ID || "schnellscrapers~indeed-jobs-scraper";

  if (!token) {
    return NextResponse.json({ error: "APIFY_API_TOKEN is not configured yet." }, { status: 503 });
  }

  const body = await request.json() as { roles?: string; locations?: string; keywords?: string; workMode?: string; minimumSalary?: string; resumeText?: string };
  const queries = [body.roles, body.keywords].filter(Boolean).join(" ").trim();
  const location = body.locations?.split(",")[0]?.trim();

  if (!queries || !location) {
    return NextResponse.json({ error: "Target roles and a location are required." }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(APIFY_TIMEOUT_MS),
      body: JSON.stringify({ searches: [{ query: queries, location, country: "US" }], maxRecords: 5, maxPagesPerSearch: 1 }),
    });
  } catch (error) {
    const isTimeout = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name);
    const elapsedSeconds = Math.ceil((Date.now() - startedAt) / 1000);
    console.warn(`[job-search] Apify ${isTimeout ? "timed out" : "request failed"} after ${elapsedSeconds}s`);
    return NextResponse.json(
      {
        error: isTimeout
          ? "Job search is taking longer than expected. Please try again in a moment."
          : "We could not reach the job provider. Please try again in a moment.",
      },
      { status: isTimeout ? 504 : 502 },
    );
  }
  console.info(`[job-search] Apify completed in ${Date.now() - startedAt}ms`);

  if (!response.ok) {
    return NextResponse.json({ error: `Apify returned ${response.status}. Check the Actor ID and input schema.` }, { status: 502 });
  }

  const items = await response.json() as ApifyJob[];
  const jobs = dedupeJobs(normalizeJobs(items));
  console.info(`[job-search] normalized ${jobs.length} jobs`);

  const profile = {
    targetRoles: body.roles?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    skills: body.keywords?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    searchKeywords: body.keywords?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    preferredLocations: body.locations?.split(",").map((value) => value.trim()).filter(Boolean) ?? [],
    workModes: body.workMode ? [body.workMode] : [],
    minimumSalary: Number.parseInt(body.minimumSalary?.replace(/[^0-9]/g, "") || "", 10) || null,
    resumeText: body.resumeText || "",
  };

  const eligibleJobs = jobs.filter((job) => passesHardFilters(profile, { role: job.title, company: job.company, location: job.location, description: job.description, salary: job.salary }));
  const jobsToAnalyze = eligibleJobs.length > 0 ? eligibleJobs : jobs;
  const usedFilterFallback = eligibleJobs.length === 0 && jobs.length > 0;
  console.info(`[job-search] ${eligibleJobs.length} jobs passed hard filters${usedFilterFallback ? "; analyzing fetched jobs instead" : ""}`);

  try {
    const useDatabase = shouldUseDatabase();
    const storage = useDatabase ? "saved" : "memory";
    let userId: string | null = null;

    if (useDatabase) {
      try {
        const user = await prisma.user.upsert({ where: { email: "demo@personal-assistant.local" }, update: {}, create: { email: "demo@personal-assistant.local" } });
        userId = user.id;
        await prisma.candidateProfile.upsert({ where: { userId: user.id }, update: profile, create: { userId: user.id, ...profile } });
      } catch (dbError) {
        console.warn("[job-search] database unavailable, continuing without persistence", dbError);
        userId = null;
      }
    }

    const processedJobs = await Promise.all(
      jobsToAnalyze.map(async (job) => {
        const analysisInput = {
          role: job.title,
          company: job.company,
          location: job.location,
          description: job.description,
          salary: job.salary,
        };
        let analysis;
        try {
          analysis = await analyzeJobWithLLM(profile, analysisInput);
          console.info(`[job-search] ${job.title} analyzed by ${analysis.modelUsed || "unknown model"}`);
        } catch (analysisError) {
          console.warn("[job-search] falling back to rule-based analysis", job.title, analysisError);
          analysis = analyzeJob(profile, analysisInput);
        }

        if (!userId) {
          return { ...job, analysis };
        }

        const persistedAnalysis = { ...analysis };
        delete persistedAnalysis.modelUsed;
        try {
          const existing = job.url ? await prisma.job.findFirst({ where: { userId, url: job.url } }) : null;
          const savedJob = existing
            ? await prisma.job.update({
                where: { id: existing.id },
                data: {
                  company: job.company,
                  role: job.title,
                  description: job.description,
                  salary: job.salary,
                  location: job.location,
                  source: job.source,
                  postedAt: job.postedAt,
                },
              })
            : await prisma.job.create({
                data: {
                  userId,
                  company: job.company,
                  role: job.title,
                  description: job.description,
                  salary: job.salary,
                  location: job.location,
                  url: job.url || null,
                  source: job.source,
                  postedAt: job.postedAt,
                },
              });
          await prisma.jobAnalysis.upsert({
            where: { jobId: savedJob.id },
            update: persistedAnalysis,
            create: { jobId: savedJob.id, ...persistedAnalysis },
          });
          return { ...job, id: savedJob.id, analysis };
        } catch (persistError) {
          console.warn("[job-search] persistence skipped for job", job.title, persistError);
          return { ...job, analysis };
        }
      }),
    );

    const rankedJobs = processedJobs.sort((a, b) => b.analysis.matchScore - a.analysis.matchScore);
    console.info(`[job-search] completed in ${Date.now() - startedAt}ms`);
    return NextResponse.json({
      jobs: rankedJobs,
      storage,
      discovered: jobs.length,
      hardFilterMatches: eligibleJobs.length,
      usedFilterFallback,
    });
  } catch (error) {
    console.error("[job-search] analysis failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Job analysis failed." }, { status: 502 });
  }
}
