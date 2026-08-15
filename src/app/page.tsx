const fields = [
  { label: "Target roles", placeholder: "e.g. Staff Frontend Engineer, Engineering Manager" },
  { label: "Preferred locations", placeholder: "e.g. San Francisco, New York, Remote" },
  { label: "Keywords", placeholder: "e.g. React, TypeScript, platform" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f2] px-6 py-10 text-[#17221c] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#47715b] uppercase">Personal Assistant</p>
          <span className="rounded-full border border-[#c9d8c8] bg-white px-3 py-1 text-xs font-medium text-[#47715b]">Phase 1 · Job Discovery</span>
        </header>

        <section className="py-16 sm:py-24">
          <p className="mb-4 text-sm font-medium text-[#c06c42]">Let&apos;s set your search up.</p>
          <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-7xl">
            Tell us what kind of opportunity to find.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#607064]">
            We&apos;ll use your resume and preferences to collect relevant postings, then help you focus on the strongest opportunities.
          </p>

          <form className="mt-12 grid gap-6 rounded-3xl border border-[#dbe5d8] bg-white p-6 shadow-[0_20px_60px_rgba(47,96,71,0.08)] sm:p-8">
            <div>
              <label className="text-sm font-semibold" htmlFor="resume">Resume</label>
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b8cdb8] bg-[#f8faf6] px-6 py-10 text-center transition hover:border-[#47715b]" htmlFor="resume">
                <span className="text-sm font-semibold text-[#47715b]">Upload your resume</span>
                <span className="mt-2 text-xs text-[#7b8b7e]">PDF or DOCX · used to build your candidate profile</span>
                <input className="sr-only" id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {fields.map((field) => (
                <label className="text-sm font-semibold" key={field.label}>
                  {field.label}
                  <input className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none transition placeholder:text-[#a3afa4] focus:border-[#47715b]" name={field.label.toLowerCase().replaceAll(" ", "-")} placeholder={field.placeholder} />
                </label>
              ))}
              <label className="text-sm font-semibold">
                Work mode
                <select className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none focus:border-[#47715b]" defaultValue="remote-hybrid">
                  <option value="remote-hybrid">Remote or hybrid</option>
                  <option value="remote">Remote only</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="onsite">On-site</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Minimum salary <span className="font-normal text-[#7b8b7e]">(optional)</span>
                <input className="mt-2 w-full rounded-xl border border-[#dbe5d8] bg-[#fbfcfa] px-4 py-3 font-normal outline-none transition placeholder:text-[#a3afa4] focus:border-[#47715b]" name="minimum-salary" placeholder="$150,000" />
              </label>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t border-[#edf1ea] pt-6 sm:flex-row sm:items-center">
              <p className="text-xs leading-5 text-[#7b8b7e]">You&apos;ll review your extracted profile before any job search begins.</p>
              <button className="rounded-full bg-[#2f6047] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38]" type="submit">Create my profile</button>
            </div>
          </form>
        </section>

        <footer className="border-t border-[#dbe5d8] py-6 text-sm text-[#7b8b7e]">Collect first. Prioritize second. You stay in control.</footer>
      </div>
    </main>
  );
}
