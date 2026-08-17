export type JobCandidate = { id: string; company: string; role: string };

const confirmationPattern = /thank you for (your )?application|application (has been|was) received|we received your application|application confirmation|thanks for applying/i;
const ignoredTitleWords = new Set(["senior", "staff", "lead", "principal", "engineer", "developer", "manager", "software", "the", "and", "for", "with"]);

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export function matchApplicationConfirmation(jobs: JobCandidate[], email: { sender: string | null; subject: string; snippet: string }) {
  const emailText = normalize(`${email.sender || ""} ${email.subject} ${email.snippet}`);
  if (!confirmationPattern.test(`${email.subject} ${email.snippet}`)) return null;

  return jobs.find((job) => {
    const company = normalize(job.company);
    const companyMatched = company.length >= 4 && emailText.includes(company);
    const roleWords = normalize(job.role).split(" ").filter((word) => word.length >= 4 && !ignoredTitleWords.has(word));
    const roleMatches = roleWords.filter((word) => emailText.includes(word)).length;
    return companyMatched || roleMatches >= Math.min(2, roleWords.length);
  }) || null;
}
