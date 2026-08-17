"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type CandidateProfile = { resumeFileName: string; resumeText: string; targetRoles: string; preferredLocations: string; keywords: string; workMode: string; minimumSalary: string; postedToday: boolean };
type Job = { title: string; company: string; location: string; description: string; url: string; salary: string | null; posted: string | null };
type JobSearchResult = { jobs?: Job[]; error?: string };

const initialProfile: CandidateProfile = { resumeFileName: "", resumeText: "", targetRoles: "senior frontend engineer", preferredLocations: "san francisco bay area", keywords: "react, typescript", workMode: "remote-hybrid", minimumSalary: "150000", postedToday: true };

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState("");
  const [uploadingResume, setUploadingResume] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchSeconds, setSearchSeconds] = useState(0);

  useEffect(() => {
    if (!searching) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSearchSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [searching]);

  function updateProfile(field: keyof CandidateProfile, value: string) { setProfile((current) => ({ ...current, [field]: value })); }

  async function handleResumeUpload(file: File | undefined) {
    if (!file) { setProfile((current) => ({ ...current, resumeFileName: "", resumeText: "" })); return; }
    setUploadingResume(true); setError(""); setProfile((current) => ({ ...current, resumeFileName: "", resumeText: "" }));
    try {
      const formData = new FormData(); formData.append("resume", file);
      const response = await fetch("/api/resume/extract", { method: "POST", body: formData });
      const result = await response.json().catch(() => ({} as { text?: string; error?: string }));
      const resumeText = result.text?.trim() || "";
      if (!response.ok || !resumeText) { setError(result.error || "We could not read that resume. Please try a text-based PDF or DOCX file."); return; }
      setProfile((current) => ({ ...current, resumeFileName: file.name, resumeText }));
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "We could not read that resume."); } finally { setUploadingResume(false); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile.resumeText.trim()) { setError("Please upload a readable PDF or DOCX resume before creating your profile."); return; }
    if (!profile.targetRoles.trim() || !profile.preferredLocations.trim()) { setError("Please add at least one target role and preferred location."); return; }
    window.sessionStorage.setItem("career-profile", JSON.stringify(profile)); setError(""); setProfileReady(true);
  }

  async function searchJobs() {
    setSearching(true); setSearchSeconds(0); setError("");
    try {
      const response = await fetch("/api/jobs/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ roles: profile.targetRoles, locations: profile.preferredLocations, keywords: profile.keywords, workMode: profile.workMode, minimumSalary: profile.minimumSalary, resumeText: profile.resumeText, postedToday: profile.postedToday }) });
      const result = await response.json().catch(() => ({} as JobSearchResult));
      if (!response.ok) { setError(result.error || `Job search failed (${response.status}).`); return; }
      window.sessionStorage.setItem("latest-job-search", JSON.stringify(result.jobs || []));
      router.push("/listings?newSearch=1");
    } catch (searchError) { setError(searchError instanceof Error ? searchError.message : "Job search could not be completed."); } finally { setSearching(false); }
  }

  return <main className="min-h-screen bg-[#f6f7f2] px-6 py-10 text-[#17221c] sm:px-10 lg:px-16"><div className="mx-auto max-w-5xl"><section className="py-10 sm:py-16"><p className="mb-4 text-sm font-medium text-[#c06c42]">Profile setup</p><h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-7xl">Tell your assistant what to look for.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#607064]">Your profile guides job discovery and gives the assistant the context it needs to evaluate opportunities.</p><form className="mt-12 grid gap-6 rounded-3xl border border-[#dbe5d8] bg-white p-6 shadow-[0_20px_60px_rgba(47,96,71,0.08)] sm:p-8" onSubmit={handleSubmit}><div><label className="text-sm font-semibold" htmlFor="resume">Resume</label><label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b8cdb8] bg-[#f8faf6] px-6 py-10 text-center transition hover:border-[#47715b]" htmlFor="resume"><span className="text-sm font-semibold text-[#47715b]">{uploadingResume ? "Reading your resume…" : profile.resumeFileName || "Upload your resume"}</span><span className="mt-2 text-xs text-[#7b8b7e]">PDF or DOCX · used to personalize matching</span><input className="sr-only" disabled={uploadingResume} id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" onChange={(event) => void handleResumeUpload(event.target.files?.[0])} /></label>{profile.resumeText && <p className="mt-2 text-xs text-[#47715b]">Resume read successfully · {profile.resumeText.length.toLocaleString()} characters ready for matching.</p>}</div><div className="grid gap-5 md:grid-cols-2"><ProfileInput label="Target roles" placeholder="e.g. Staff Frontend Engineer" value={profile.targetRoles} onChange={(value) => updateProfile("targetRoles", value)} /><ProfileInput label="Preferred locations" placeholder="e.g. San Francisco, Remote" value={profile.preferredLocations} onChange={(value) => updateProfile("preferredLocations", value)} /><ProfileInput label="Keywords" placeholder="e.g. React, TypeScript" value={profile.keywords} onChange={(value) => updateProfile("keywords", value)} /><label className="text-sm font-semibold">Work mode<select className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#47715b]" value={profile.workMode} onChange={(event) => updateProfile("workMode", event.target.value)}><option value="remote-hybrid">Remote or hybrid</option><option value="remote">Remote only</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select></label><ProfileInput label="Minimum salary (optional)" placeholder="$150,000" value={profile.minimumSalary} onChange={(value) => updateProfile("minimumSalary", value)} /><label className="flex items-center gap-3 rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 text-sm font-semibold md:col-span-2"><input checked={profile.postedToday} className="h-4 w-4 accent-[#2f6047]" type="checkbox" onChange={(event) => setProfile((current) => ({ ...current, postedToday: event.target.checked }))} /><span>Only search postings from the last 24 hours</span></label></div>{error && <p className="rounded-xl bg-[#fff1eb] px-4 py-3 text-sm text-[#a34f2e]" role="alert">{error}</p>}<div className="flex flex-col justify-between gap-4 border-t border-[#edf1ea] pt-6 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-[#7b8b7e]">You control when a search starts. Nothing is sent on your behalf.</p><button className="rounded-full bg-[#2f6047] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38] disabled:cursor-wait disabled:opacity-60" disabled={uploadingResume} type="submit">{profileReady ? "Update my profile" : "Create my profile"}</button></div></form>{profileReady && <section className="mt-6 flex flex-col justify-between gap-4 rounded-3xl border border-[#dbe5d8] bg-white p-6 sm:flex-row sm:items-center"><div><p className="text-sm font-medium text-[#c06c42]">Ready to discover</p><h2 className="mt-1 text-2xl font-semibold">Search the job boards</h2><p className="mt-1 text-sm text-[#7b8b7e]">Results will open in Listings, ranked for your profile.</p></div><div className="flex items-center gap-3">{searching && <span className="text-xs font-medium text-[#7b8b7e]" role="status">Elapsed: {searchSeconds}s</span>}<button className="rounded-full bg-[#2f6047] px-6 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60" disabled={searching} onClick={() => void searchJobs()} type="button">{searching ? `Searching… ${searchSeconds}s` : "Search jobs"}</button></div></section>}</section></div></main>;
}

function ProfileInput({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) { return <label className="text-sm font-semibold">{label}<input className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none transition placeholder:text-[#a3afa4] focus:border-[#47715b]" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>; }
