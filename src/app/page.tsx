"use client";

import { FormEvent, useState } from "react";

type CandidateProfile = {
  resumeFileName: string;
  targetRoles: string;
  preferredLocations: string;
  keywords: string;
  workMode: string;
  minimumSalary: string;
};

type Job = { title: string; company: string; location: string; description: string; url: string; salary: string | null; posted: string | null };

const initialProfile: CandidateProfile = { resumeFileName: "", targetRoles: "", preferredLocations: "", keywords: "", workMode: "remote-hybrid", minimumSalary: "" };

export default function Home() {
  const [profile, setProfile] = useState(initialProfile);
  const [savedProfile, setSavedProfile] = useState<CandidateProfile | null>(null);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searching, setSearching] = useState(false);

  function updateProfile(field: keyof CandidateProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.resumeFileName) {
      setError("Please upload a resume before creating your profile.");
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
    setError("");
    const response = await fetch("/api/jobs/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: savedProfile.targetRoles, locations: savedProfile.preferredLocations, keywords: savedProfile.keywords }) });
    const result = await response.json() as { jobs?: Job[]; error?: string };
    setSearching(false);
    if (!response.ok) {
      setError(result.error || "Job search failed.");
      return;
    }
    setJobs(result.jobs || []);
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
            <div className="mt-10 grid gap-4 rounded-3xl border border-[#dbe5d8] bg-white p-7 shadow-[0_20px_60px_rgba(47,96,71,0.08)]"><ProfileRow label="Resume" value={savedProfile.resumeFileName} /><ProfileRow label="Target roles" value={savedProfile.targetRoles} /><ProfileRow label="Locations" value={savedProfile.preferredLocations} /><ProfileRow label="Keywords" value={savedProfile.keywords || "None added"} /><ProfileRow label="Work mode" value={savedProfile.workMode} /><ProfileRow label="Minimum salary" value={savedProfile.minimumSalary || "No minimum"} /></div>
            <div className="mt-8 flex items-center justify-between gap-4"><div><h2 className="text-xl font-semibold">Job discovery</h2><p className="mt-1 text-sm text-[#7b8b7e]">Search Indeed through Apify using this profile.</p></div><button className="rounded-full bg-[#2f6047] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38] disabled:cursor-wait disabled:opacity-60" disabled={searching} onClick={searchJobs} type="button">{searching ? "Searching…" : "Search jobs"}</button></div>
            {error && <p className="mt-4 rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a34f2e]" role="alert">{error}</p>}
            {jobs.length > 0 && <div className="mt-6 grid gap-4">{jobs.map((job, index) => <article className="rounded-2xl border border-[#dbe5d8] bg-white p-5" key={`${job.url}-${index}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{job.title}</h3><p className="mt-1 text-sm text-[#607064]">{job.company} · {job.location}</p></div>{job.posted && <span className="text-xs text-[#7b8b7e]">{job.posted}</span>}</div>{job.salary && <p className="mt-3 text-sm font-medium text-[#47715b]">{job.salary}</p>}<p className="mt-3 line-clamp-3 text-sm leading-6 text-[#718074]">{job.description}</p>{job.url && <a className="mt-4 inline-block text-sm font-semibold text-[#2f6047] underline" href={job.url} rel="noreferrer" target="_blank">View posting →</a>}</article>)}</div>}
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
            <div><label className="text-sm font-semibold" htmlFor="resume">Resume</label><label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b8cdb8] bg-[#f8faf6] px-6 py-10 text-center transition hover:border-[#47715b]" htmlFor="resume"><span className="text-sm font-semibold text-[#47715b]">{profile.resumeFileName || "Upload your resume"}</span><span className="mt-2 text-xs text-[#7b8b7e]">PDF or DOCX · used to build your candidate profile</span><input className="sr-only" id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" onChange={(event) => updateProfile("resumeFileName", event.target.files?.[0]?.name || "")} /></label></div>
            <div className="grid gap-5 md:grid-cols-2"><ProfileInput label="Target roles" placeholder="e.g. Staff Frontend Engineer, Engineering Manager" value={profile.targetRoles} onChange={(value) => updateProfile("targetRoles", value)} /><ProfileInput label="Preferred locations" placeholder="e.g. San Francisco, New York, Remote" value={profile.preferredLocations} onChange={(value) => updateProfile("preferredLocations", value)} /><ProfileInput label="Keywords" placeholder="e.g. React, TypeScript, platform" value={profile.keywords} onChange={(value) => updateProfile("keywords", value)} /><label className="text-sm font-semibold">Work mode<select className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#47715b]" value={profile.workMode} onChange={(event) => updateProfile("workMode", event.target.value)}><option value="remote-hybrid">Remote or hybrid</option><option value="remote">Remote only</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><ProfileInput label="Minimum salary (optional)" placeholder="$150,000" value={profile.minimumSalary} onChange={(value) => updateProfile("minimumSalary", value)} /></div>
            {error && <p className="rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a34f2e]" role="alert">{error}</p>}
            <div className="flex flex-col justify-between gap-4 border-t border-[#edf1ea] pt-6 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-[#7b8b7e]">You&apos;ll review your profile before any job search begins.</p><button className="rounded-full bg-[#2f6047] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38]" type="submit">Create my profile</button></div>
          </form>
        </section>
        <footer className="border-t border-[#dbe5d8] py-6 text-sm text-[#7b8b7e]">Collect first. Prioritize second. You stay in control.</footer>
      </div>
    </main>
  );
}

function ProfileInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-semibold">{label}<input className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none transition placeholder:text-[#a3afa4] focus:border-[#47715b]" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }

function ProfileRow({ label, value }: { label: string; value: string }) { return <div className="flex flex-col gap-1 border-b border-[#edf1ea] pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"><span className="text-xs font-semibold tracking-[0.12em] text-[#7b8b7e] uppercase">{label}</span><span className="max-w-xl text-sm font-medium sm:text-right">{value}</span></div>; }
