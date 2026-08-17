"use client";

import { FormEvent, useEffect, useState } from "react";

type CandidateProfile = {
  resumeFileName: string;
  resumeText: string;
  targetRoles: string;
  preferredLocations: string;
  keywords: string;
  workMode: string;
  minimumSalary: string;
};

type JobAnalysis = { matchScore: number; recommendation: string; strengths: string[]; gaps: string[]; concerns: string[]; reasoning: string; modelUsed?: string };
type Job = { id?: string; title: string; company: string; location: string; description: string; url: string; salary: string | null; posted: string | null; source?: string; savedAt?: string; analysis?: JobAnalysis };
type SavedJobsResult = { jobs?: Job[]; page?: number; totalPages?: number; total?: number; error?: string; discovered?: number; hardFilterMatches?: number; usedFilterFallback?: boolean };

const initialProfile: CandidateProfile = { resumeFileName: "", resumeText: "", targetRoles: "senior frontend engineer", preferredLocations: "san francisco bay area", keywords: "react, typescript", workMode: "remote-hybrid", minimumSalary: "150000" };

export default function Home() {
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [savedJobsPage, setSavedJobsPage] = useState(1);
  const [savedJobsTotalPages, setSavedJobsTotalPages] = useState(0);
  const [savedJobsTotal, setSavedJobsTotal] = useState(0);
  const [savedJobsQuery, setSavedJobsQuery] = useState("");
  const [savedJobsSource, setSavedJobsSource] = useState("all");
  const [showSavedJobs, setShowSavedJobs] = useState(false);
  const [loadingSavedJobs, setLoadingSavedJobs] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);
  const [uploadingResume, setUploadingResume] = useState(false);

  useEffect(() => {
    if (!searching) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSearchSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [searching]);

  function updateProfile(field: keyof CandidateProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function handleResumeUpload(file: File | undefined) {
    if (!file) {
      setProfile((current) => ({ ...current, resumeFileName: "", resumeText: "" }));
      return;
    }

    setUploadingResume(true);
    setError("");
    setProfile((current) => ({ ...current, resumeFileName: "", resumeText: "" }));
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const response = await fetch("/api/resume/extract", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({} as { text?: string; error?: string }));
      const resumeText = result.text?.trim() || "";
      if (!response.ok || !resumeText) {
        setError(result.error || "We could not read that resume. Please try a text-based PDF or DOCX file.");
        return;
      }
      setProfile((current) => ({ ...current, resumeFileName: file.name, resumeText }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "We could not read that resume.");
    } finally {
      setUploadingResume(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.resumeText.trim()) {
      setError("Please upload a readable PDF or DOCX resume before creating your profile.");
      return;
    }
    if (!profile.targetRoles.trim() || !profile.preferredLocations.trim()) {
      setError("Please add at least one target role and preferred location.");
      return;
    }
    setError("");
    setSavedProfile(profile);
  }

  async function searchJobs() {
    if (!savedProfile) return;
    setSearching(true);
    setSearchSeconds(0);
    setError("");
    try {
      const response = await fetch("/api/jobs/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: savedProfile.targetRoles, locations: savedProfile.preferredLocations, keywords: savedProfile.keywords, workMode: savedProfile.workMode, minimumSalary: savedProfile.minimumSalary, resumeText: savedProfile.resumeText }) });
      const responseText = await response.text();
      let result: SavedJobsResult = {};
      try { result = responseText ? JSON.parse(responseText) as SavedJobsResult : {}; } catch { result = {}; }
      if (!response.ok) {
        setError(result.error || `Job search failed (${response.status}). The server did not return a valid JSON response.`);
        return;
      }
      const returnedJobs = result.jobs || [];
      setJobs(returnedJobs);
      if (!returnedJobs.length) {
        setError("No postings came back from Indeed for this search. Try broadening the role or location, then search again.");
      }
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Job search could not be completed.");
    } finally {
      setSearching(false);
    }
  }

  async function loadSavedJobs(page = 1) {
    setLoadingSavedJobs(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "8", source: savedJobsSource });
      if (savedJobsQuery.trim()) params.set("q", savedJobsQuery.trim());
      const response = await fetch(`/api/jobs?${params.toString()}`);
      const responseText = await response.text();
      let result: SavedJobsResult = {};
      try {
        result = responseText ? JSON.parse(responseText) as SavedJobsResult : {};
      } catch {
        result = {};
      }
      if (!response.ok) {
        setError(result.error || "Saved jobs could not be loaded.");
        return;
      }
      setSavedJobs(result.jobs || []);
      setSavedJobsPage(result.page || page);
      setSavedJobsTotalPages(result.totalPages || 0);
      setSavedJobsTotal(result.total || 0);
      setShowSavedJobs(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Saved jobs could not be loaded.");
    } finally {
      setLoadingSavedJobs(false);
    }
  }

  function toggleSavedJobs() {
    if (showSavedJobs) {
      setShowSavedJobs(false);
      return;
    }
    void loadSavedJobs(1);
  }

  if (savedProfile) {
    return (
      <main className="min-h-screen bg-[#f6f7f2] px-6 py-10 text-[#17221c] sm:px-10 lg:px-16">
        <div className="mx-auto max-w-3xl">
          <header className="flex items-center justify-between"><p className="text-sm font-semibold tracking-[0.18em] text-[#47715b] uppercase">Personal Assistant</p><span className="rounded-full border border-[#c9d8c8] bg-white px-3 py-1 text-xs font-medium text-[#47715b]">Profile ready</span></header>
          <section className="py-24">
            <p className="mb-4 text-sm font-medium text-[#c06c42]">Checkpoint complete.</p>
            <h1 className="text-5xl leading-[1.05] font-semibold tracking-[-0.04em]">Your search profile is ready.</h1>
            <p className="mt-6 text-lg leading-8 text-[#607064]">Review the details we&apos;ll use to find relevant job postings.</p>
            <div className="mt-10 grid gap-4 rounded-3xl border border-[#dbe5d8] bg-white p-7 shadow-[0_20px_60px_rgba(47,96,71,0.08)]"><ProfileRow label="Resume" value={savedProfile.resumeFileName} /><ProfileRow label="Resume signal" value={savedProfile.resumeText ? `${savedProfile.resumeText.slice(0, 120)}${savedProfile.resumeText.length > 120 ? "..." : ""}` : "Resume text will be extracted for matching"} /><ProfileRow label="Target roles" value={savedProfile.targetRoles} /><ProfileRow label="Locations" value={savedProfile.preferredLocations} /><ProfileRow label="Keywords" value={savedProfile.keywords || "None added"} /><ProfileRow label="Work mode" value={savedProfile.workMode} /><ProfileRow label="Minimum salary" value={savedProfile.minimumSalary || "No minimum"} /></div>
            <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-xl font-semibold">Job discovery</h2><p className="mt-1 text-sm text-[#7b8b7e]">Search Indeed through Apify using this profile.</p></div><div className="flex flex-wrap items-center gap-3">{searching && <span className="text-xs font-medium text-[#7b8b7e]" role="status">Elapsed: {searchSeconds}s</span>}<button className="rounded-full border border-[#b8cdb8] px-5 py-3 text-sm font-semibold text-[#2f6047] transition hover:bg-white disabled:opacity-60" disabled={loadingSavedJobs} onClick={toggleSavedJobs} type="button">{showSavedJobs ? "Hide saved jobs" : loadingSavedJobs ? "Loading…" : "Saved jobs"}</button><button className="rounded-full bg-[#2f6047] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38] disabled:cursor-wait disabled:opacity-60" disabled={searching} onClick={searchJobs} type="button">{searching ? `Searching… ${searchSeconds}s` : "Search jobs"}</button></div></div>
            {error && <p className="mt-4 rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a34f2e]" role="alert">{error}</p>}
            {jobs.length > 0 && <div className="mt-6 grid gap-4">{jobs.map((job, index) => <article className="rounded-2xl border border-[#dbe5d8] bg-white p-5" key={`${job.url}-${index}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{job.title}</h3><p className="mt-1 text-sm text-[#607064]">{job.company} · {job.location}</p></div>{job.posted && <span className="text-xs text-[#7b8b7e]">{job.posted}</span>}</div>{job.salary && <p className="mt-3 text-sm font-medium text-[#47715b]">{job.salary}</p>}{job.analysis && <div className="mt-4 rounded-2xl bg-[#f3f7f0] p-4"><div className="flex items-center justify-between gap-3"><span className="text-lg font-semibold text-[#2f6047]">{job.analysis.matchScore}/100</span><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#47715b]">{job.analysis.recommendation}</span></div>{job.analysis.strengths[0] && <p className="mt-3 text-sm text-[#607064]">{job.analysis.strengths[0]}</p>}<details className="mt-3 text-sm text-[#607064]"><summary className="cursor-pointer font-semibold text-[#2f6047]">Why this match?</summary>{job.analysis.strengths.length > 0 && <div className="mt-3"><p className="font-semibold text-[#2f6047]">Strengths</p><ul className="mt-1 list-disc space-y-1 pl-5">{job.analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>}{job.analysis.gaps.length > 0 && <div className="mt-3"><p className="font-semibold text-[#a34f2e]">Gaps</p><ul className="mt-1 list-disc space-y-1 pl-5">{job.analysis.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>}{job.analysis.concerns.length > 0 && <div className="mt-3"><p className="font-semibold text-[#a34f2e]">Concerns</p><ul className="mt-1 list-disc space-y-1 pl-5">{job.analysis.concerns.map((item) => <li key={item}>{item}</li>)}</ul></div>}</details></div>}{job.url && <a className="mt-4 inline-block text-sm font-semibold text-[#2f6047] underline" href={job.url} rel="noreferrer" target="_blank">View posting →</a>}</article>)}</div>}
            {showSavedJobs && <section className="mt-10 rounded-3xl border border-[#dbe5d8] bg-[#fbfcfa] p-5 sm:p-7"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-medium text-[#c06c42]">Your job shelf</p><h2 className="mt-1 text-2xl font-semibold">Saved jobs</h2><p className="mt-1 text-sm text-[#7b8b7e]">{savedJobsTotal} persisted posting{savedJobsTotal === 1 ? "" : "s"} from Postgres.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input aria-label="Search saved jobs" className="rounded-xl border border-[#dbe5d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#47715b]" placeholder="Search jobs…" value={savedJobsQuery} onChange={(event) => setSavedJobsQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void loadSavedJobs(1); }} /><select aria-label="Filter saved jobs by source" className="rounded-xl border border-[#dbe5d8] bg-white px-3 py-2 text-sm outline-none focus:border-[#47715b]" value={savedJobsSource} onChange={(event) => { setSavedJobsSource(event.target.value); void loadSavedJobs(1); }}><option value="all">All sources</option><option value="Indeed">Indeed</option></select><button className="rounded-xl bg-[#2f6047] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={loadingSavedJobs} onClick={() => void loadSavedJobs(1)} type="button">Filter</button></div></div>{savedJobs.length === 0 && !loadingSavedJobs ? <p className="mt-6 rounded-2xl border border-dashed border-[#b8cdb8] px-4 py-8 text-center text-sm text-[#7b8b7e]">No saved jobs match these filters.</p> : <div className="mt-6 grid gap-4">{savedJobs.map((job) => <article className="rounded-2xl border border-[#dbe5d8] bg-white p-5" key={job.id}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{job.title}</h3><p className="mt-1 text-sm text-[#607064]">{job.company} · {job.location}</p></div><span className="text-xs text-[#7b8b7e]">{job.source}</span></div>{job.salary && <p className="mt-3 text-sm font-medium text-[#47715b]">{job.salary}</p>}{job.analysis && <div className="mt-4 rounded-2xl bg-[#f3f7f0] p-4"><div className="flex items-center justify-between"><span className="text-lg font-semibold text-[#2f6047]">{job.analysis.matchScore}/100</span><span className="text-xs font-semibold text-[#47715b]">{job.analysis.recommendation}</span></div>{job.analysis.strengths.length > 0 && <p className="mt-2 text-sm text-[#607064]">{job.analysis.strengths.join(" ")}</p>}</div>}{job.url && <a className="mt-4 inline-block text-sm font-semibold text-[#2f6047] underline" href={job.url} rel="noreferrer" target="_blank">View posting →</a>}</article>)}</div>}{savedJobsTotalPages > 1 && <div className="mt-6 flex items-center justify-between"><button className="rounded-full border border-[#b8cdb8] px-4 py-2 text-sm font-semibold text-[#2f6047] disabled:opacity-40" disabled={savedJobsPage <= 1 || loadingSavedJobs} onClick={() => void loadSavedJobs(savedJobsPage - 1)} type="button">Previous</button><span className="text-sm text-[#7b8b7e]">Page {savedJobsPage} of {savedJobsTotalPages}</span><button className="rounded-full border border-[#b8cdb8] px-4 py-2 text-sm font-semibold text-[#2f6047] disabled:opacity-40" disabled={savedJobsPage >= savedJobsTotalPages || loadingSavedJobs} onClick={() => void loadSavedJobs(savedJobsPage + 1)} type="button">Next</button></div>}</section>}
            <button className="mt-8 rounded-full border border-[#b8cdb8] px-6 py-3 text-sm font-semibold text-[#2f6047] transition hover:bg-white" onClick={() => setSavedProfile(null)} type="button">Edit profile</button>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f2] px-6 py-10 text-[#17221c] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between"><p className="text-sm font-semibold tracking-[0.18em] text-[#47715b] uppercase">Personal Assistant</p><span className="rounded-full border border-[#c9d8c8] bg-white px-3 py-1 text-xs font-medium text-[#47715b]">Phase 1 · Job Discovery</span></header>
        <section className="py-16 sm:py-24">
          <p className="mb-4 text-sm font-medium text-[#c06c42]">Let&apos;s set your search up.</p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-7xl">Tell us what kind of opportunity to find.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#607064]">We&apos;ll use your resume and preferences to collect relevant postings, then help you focus on the strongest opportunities.</p>
          <form className="mt-12 grid gap-6 rounded-3xl border border-[#dbe5d8] bg-white p-6 shadow-[0_20px_60px_rgba(47,96,71,0.08)] sm:p-8" onSubmit={handleSubmit}>
            <div><label className="text-sm font-semibold" htmlFor="resume">Resume</label><label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b8cdb8] bg-[#f8faf6] px-6 py-10 text-center transition hover:border-[#47715b]" htmlFor="resume"><span className="text-sm font-semibold text-[#47715b]">{uploadingResume ? "Reading your resume…" : profile.resumeFileName || "Upload your resume"}</span><span className="mt-2 text-xs text-[#7b8b7e]">PDF or DOCX · used to build your candidate profile</span><input className="sr-only" disabled={uploadingResume} id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" onChange={(event) => void handleResumeUpload(event.target.files?.[0])} /></label>{profile.resumeText && <p className="mt-2 text-xs text-[#47715b]">Resume read successfully · {profile.resumeText.length.toLocaleString()} characters ready for matching.</p>}</div>
            <div className="grid gap-5 md:grid-cols-2"><ProfileInput label="Target roles" placeholder="e.g. Staff Frontend Engineer, Engineering Manager" value={profile.targetRoles} onChange={(value) => updateProfile("targetRoles", value)} /><ProfileInput label="Preferred locations" placeholder="e.g. San Francisco, New York, Remote" value={profile.preferredLocations} onChange={(value) => updateProfile("preferredLocations", value)} /><ProfileInput label="Keywords" placeholder="e.g. React, TypeScript, platform" value={profile.keywords} onChange={(value) => updateProfile("keywords", value)} /><label className="text-sm font-semibold">Work mode<select className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#47715b]" value={profile.workMode} onChange={(event) => updateProfile("workMode", event.target.value)}><option value="remote-hybrid">Remote or hybrid</option><option value="remote">Remote only</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><ProfileInput label="Minimum salary (optional)" placeholder="$150,000" value={profile.minimumSalary} onChange={(value) => updateProfile("minimumSalary", value)} /></div>
            {error && <p className="rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a34f2e]" role="alert">{error}</p>}
            <div className="flex flex-col justify-between gap-4 border-t border-[#edf1ea] pt-6 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-[#7b8b7e]">You&apos;ll review your profile before any job search begins.</p><button className="rounded-full bg-[#2f6047] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38] disabled:cursor-wait disabled:opacity-60" disabled={uploadingResume} type="submit">Create my profile</button></div>
          </form>
        </section>
        <footer className="border-t border-[#dbe5d8] py-6 text-sm text-[#7b8b7e]">Collect first. Prioritize second. You stay in control.</footer>
      </div>
    </main>
  );
}

function ProfileInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-semibold">{label}<input className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none transition placeholder:text-[#a3afa4] focus:border-[#47715b]" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }

function ProfileRow({ label, value }: { label: string; value: string }) { return <div className="flex flex-col gap-1 border-b border-[#edf1ea] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"><span className="text-xs font-semibold tracking-[0.12em] text-[#7b8b7e] uppercase">{label}</span><span className="max-w-xl text-sm font-medium sm:text-right">{value}</span></div>; }
