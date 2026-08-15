const focusAreas = [
  { label: "Job intelligence", detail: "Analyze fit, strengths, gaps, and concerns." },
  { label: "Career email triage", detail: "Read, classify, and recommend next steps." },
  { label: "Human in the loop", detail: "Review, edit, approve, then act." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f6f7f2] px-6 py-10 text-[#17221c] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between">
          <p className="text-sm font-semibold tracking-[0.18em] text-[#47715b] uppercase">Career Copilot</p>
          <span className="rounded-full border border-[#c9d8c8] bg-white px-3 py-1 text-xs font-medium text-[#47715b]">Week 1</span>
        </header>

        <section className="grid gap-12 py-24 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="mb-5 text-sm font-medium text-[#c06c42]">Good morning, career search.</p>
            <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-[-0.04em] sm:text-7xl">
              Make today&apos;s next move easier to see.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#607064]">
              Career Copilot brings your job search into focus with practical intelligence, structured recommendations, and you in control.
            </p>
            <button className="mt-9 rounded-full bg-[#2f6047] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#244c38]">
              Add a job to analyze
            </button>
          </div>

          <div className="rounded-3xl border border-[#dbe5d8] bg-white p-7 shadow-[0_20px_60px_rgba(47,96,71,0.08)]">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#7b8b7e] uppercase">First vertical slices</p>
            <div className="mt-6 space-y-5">
              {focusAreas.map((area, index) => (
                <div className="flex gap-4" key={area.label}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0e5] text-xs font-bold text-[#47715b]">0{index + 1}</span>
                  <div>
                    <p className="font-semibold">{area.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[#718074]">{area.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="border-t border-[#dbe5d8] py-6 text-sm text-[#7b8b7e]">A focused foundation for an agentic career search.</footer>
      </div>
    </main>
  );
}
