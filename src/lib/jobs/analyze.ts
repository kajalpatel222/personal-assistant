export type AnalysisProfile = {
  targetRoles?: string[];
  skills?: string[];
  searchKeywords?: string[];
  preferredLocations?: string[];
  workModes?: string[];
  minimumSalary?: number | null;
};

export type AnalysisJob = {
  role: string;
  company: string;
  location?: string | null;
  description?: string | null;
  salary?: string | null;
};

export type JobAnalysisResult = {
  matchScore: number;
  recommendation: string;
  strengths: string[];
  gaps: string[];
  concerns: string[];
  reasoning: string;
};

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
const tokens = (value: string) => new Set(clean(value).split(/\s+/).filter((token) => token.length > 1));

const includesPhrase = (haystack: string, needle: string) => {
  const target = clean(needle);
  return target.length > 1 && clean(haystack).includes(target);
};

const overlap = (haystack: string, values: string[]) => values.filter((value) => includesPhrase(haystack, value));

const parseSalary = (salary?: string | null) => {
  if (!salary) return null;
  const numbers = salary.replace(/,/g, "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (!numbers.length) return null;
  const annual = numbers.every((number) => number < 1000) ? Math.max(...numbers) * 1000 : Math.max(...numbers);
  return annual;
};

const roleMatches = (jobRole: string, roles: string[]) => roles.some((role) => includesPhrase(jobRole, role) || includesPhrase(role, jobRole));

export function analyzeJob(profile: AnalysisProfile, job: AnalysisJob): JobAnalysisResult {
  const roles = profile.targetRoles ?? [];
  const skills = [...(profile.skills ?? []), ...(profile.searchKeywords ?? [])];
  const locationPreferences = profile.preferredLocations ?? [];
  const jobText = [job.role, job.description, job.location].filter(Boolean).join(" ");
  const matchedSkills = overlap(jobText, skills);
  const missingSkills = skills.filter((skill) => !matchedSkills.includes(skill));
  const roleMatch = roles.length === 0 || roleMatches(job.role, roles);
  const locationMatch = locationPreferences.length === 0 || locationPreferences.some((location) => includesPhrase(job.location ?? "", location) || includesPhrase(location, job.location ?? ""));
  const workModeMatch = (profile.workModes ?? []).length === 0 || (profile.workModes ?? []).some((mode) => includesPhrase(jobText, mode));
  const salary = parseSalary(job.salary);
  const salaryMatch = profile.minimumSalary == null || salary == null || salary >= profile.minimumSalary;

  const rolePoints = roleMatch ? 35 : 0;
  const skillPoints = skills.length ? Math.round((matchedSkills.length / skills.length) * 40) : 40;
  const locationPoints = locationMatch ? 15 : 0;
  const workModePoints = workModeMatch ? 5 : 0;
  const salaryPoints = salaryMatch ? 5 : 0;
  const matchScore = Math.max(0, Math.min(100, rolePoints + skillPoints + locationPoints + workModePoints + salaryPoints));

  const strengths = [
    ...(roleMatch && roles.length ? [`Role aligns with ${roles.find((role) => roleMatches(job.role, [role])) ?? "a target role"}.`] : []),
    ...(matchedSkills.length ? [`Mentions ${matchedSkills.join(", ")}.`] : []),
    ...(locationMatch && locationPreferences.length ? ["Location matches your preference."] : []),
  ];
  const gaps = [
    ...(!roleMatch && roles.length ? [`Role does not clearly match: ${roles.join(", ")}.`] : []),
    ...(missingSkills.length ? [`Skills not found in the posting: ${missingSkills.join(", ")}.`] : []),
    ...(!locationMatch && locationPreferences.length ? ["Location does not match your stated preference."] : []),
  ];
  const concerns = [
    ...(salary == null && profile.minimumSalary != null ? ["Salary is not disclosed, so the minimum cannot be verified."] : []),
    ...(salary != null && profile.minimumSalary != null && salary < profile.minimumSalary ? [`Listed compensation may be below your minimum of ${profile.minimumSalary}.`] : []),
    ...(!workModeMatch && (profile.workModes ?? []).length ? ["The preferred work mode is not clearly mentioned."] : []),
  ];
  const recommendation = matchScore >= 80 ? "Strong match" : matchScore >= 65 ? "Good fit" : matchScore >= 50 ? "Potential fit" : "Weak match";
  const reasoning = `${recommendation}: ${matchScore}/100 based on role alignment (${rolePoints}/35), skill overlap (${skillPoints}/40), location (${locationPoints}/15), work mode (${workModePoints}/5), and compensation (${salaryPoints}/5).`;

  return { matchScore, recommendation, strengths, gaps, concerns, reasoning };
}

function parseAnalysis(value: unknown): JobAnalysisResult {
  if (!value || typeof value !== "object") throw new Error("The model returned an invalid analysis.");
  const result = value as Record<string, unknown>;
  const matchScore = Number(result.matchScore);
  if (!Number.isFinite(matchScore) || typeof result.recommendation !== "string" || typeof result.reasoning !== "string") {
    throw new Error("The model returned an incomplete analysis.");
  }
  const asStrings = (field: string) => Array.isArray(result[field]) ? result[field].filter((item): item is string => typeof item === "string") : [];
  return {
    matchScore: Math.max(0, Math.min(100, Math.round(matchScore))),
    recommendation: result.recommendation,
    strengths: asStrings("strengths"),
    gaps: asStrings("gaps"),
    concerns: asStrings("concerns"),
    reasoning: result.reasoning,
  };
}

export async function analyzeJobWithLLM(profile: AnalysisProfile, job: AnalysisJob): Promise<JobAnalysisResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "liquid/lfm-2.5-2.6b:free";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY must be configured.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a careful career-matching assistant. Evaluate the candidate against the job using only the supplied information. Do not invent experience. Return only valid JSON with keys matchScore (integer 0-100), recommendation, strengths (array of strings), gaps (array of strings), concerns (array of strings), and reasoning (string)." },
        { role: "user", content: JSON.stringify({ candidateProfile: profile, job }) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The model returned no analysis.");
  return parseAnalysis(JSON.parse(content));
}
