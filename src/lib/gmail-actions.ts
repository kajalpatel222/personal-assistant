export type ActionableEmail = {
  category: string;
  isUnread: boolean;
  threadHasReply: boolean;
  receivedAt: Date | string | null;
};

export type EmailActionPlan = {
  actionType: "REPLY" | "FOLLOW_UP" | "REVIEW";
  priority: number;
  priorityReason: string;
};

export function planEmailAction(message: ActionableEmail): EmailActionPlan | null {
  if (message.category === "REJECTED") return null;
  const daysSince = message.receivedAt ? Math.floor((Date.now() - new Date(message.receivedAt).getTime()) / 86_400_000) : 0;
  const unreadBoost = message.isUnread ? 8 : 0;

  if (message.category === "OFFER") return { actionType: "REPLY", priority: Math.min(100, 92 + unreadBoost), priorityReason: "Offer-related message needs prompt review and a response." };
  if (message.category === "INTERVIEW" && !message.threadHasReply) return { actionType: "REPLY", priority: Math.min(100, 88 + unreadBoost), priorityReason: message.isUnread ? "Unread interview-related message has no reply in the thread." : "Interview-related message has no reply in the thread." };
  if (message.category === "OUTREACH" && !message.threadHasReply) return { actionType: "REPLY", priority: Math.min(100, 74 + unreadBoost), priorityReason: message.isUnread ? "Unread recruiter outreach has no reply in the thread." : "Recruiter outreach has no reply in the thread." };
  if (message.category === "APPLICATION" && !message.threadHasReply && daysSince >= 7) return { actionType: "FOLLOW_UP", priority: Math.min(100, 58 + unreadBoost + Math.min(daysSince - 7, 12)), priorityReason: `Application update is ${daysSince} days old with no reply in the thread.` };
  if (message.isUnread && !message.threadHasReply) return { actionType: "REVIEW", priority: 40, priorityReason: "Unread job-related message needs review." };
  return null;
}

function recipientName(sender: string | null) {
  const displayName = sender?.replace(/<[^>]+>/, "").replace(/[\"']/g, "").trim();
  return displayName && !displayName.includes("@") ? displayName.split(/\s+/)[0] : null;
}

export async function generateReplyDraft(input: { actionType: string; sender: string | null; subject: string | null; snippet: string | null; signatureName: string; signatureEmail: string }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY must be configured to generate a draft.");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      temperature: 0.25,
      messages: [
        { role: "system", content: "You write concise, polished job-search email bodies. Use only supplied information; never invent names, dates, availability, or job details. Return only the body: no greeting, sign-off, signature, or subject line. Keep it under 110 words. Do not claim the candidate has accepted an offer or committed to a time." },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}.`);
  const payload = JSON.parse(raw) as { model?: string; choices?: { message?: { content?: string } }[] };
  const draftText = payload.choices?.[0]?.message?.content?.trim();
  if (!draftText) throw new Error("The model returned an empty draft.");
  const greeting = recipientName(input.sender) ? `Hi ${recipientName(input.sender)},` : "Hello,";
  const signedDraft = `${greeting}\n\n${draftText}\n\nBest,\n${input.signatureName}\n${input.signatureEmail}`;
  return { draftText: signedDraft, modelUsed: payload.model || model };
}
