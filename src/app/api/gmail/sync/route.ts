import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptRefreshToken, refreshAccessToken } from "@/lib/gmail";
import { matchApplicationConfirmation } from "@/lib/application-confirmation";

const DEMO_EMAIL = "demo@personal-assistant.local";
const JOB_MAIL_QUERY = "newer_than:365d {\"application received\" \"thank you for applying\" \"job application\" \"next steps\" \"hiring team\" interview recruiter \"job opportunity\" from:linkedin.com from:greenhouse.io from:lever.co from:ashbyhq.com}";

type GmailMessageList = { messages?: { id: string; threadId: string }[] };
type GmailMessage = {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
};

type GmailThread = { messages?: GmailMessage[] };

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())?.value || null;
}

function category(subject: string, snippet: string) {
  const text = `${subject} ${snippet}`.toLowerCase();
  if (/interview|schedule|calendar|meet with|availability/.test(text)) return "INTERVIEW";
  if (/offer|compensation|congratulations/.test(text)) return "OFFER";
  if (/rejection|unfortunately|not moving forward|other candidates/.test(text)) return "REJECTED";
  if (/recruiter|opportunity|would love to chat/.test(text)) return "OUTREACH";
  if (/application|applied|application received|next steps/.test(text)) return "APPLICATION";
  return "JOB_RELATED";
}

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, include: { gmailConnection: true } });
    if (!user?.gmailConnection) return NextResponse.json({ error: "Connect Gmail before syncing." }, { status: 404 });

    const accessToken = (await refreshAccessToken(decryptRefreshToken(user.gmailConnection.refreshTokenEncrypted))).access_token!;
    const listResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${new URLSearchParams({ q: JOB_MAIL_QUERY, maxResults: "50" })}`, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
    if (!listResponse.ok) return NextResponse.json({ error: "Gmail could not list job-related messages." }, { status: 502 });
    const listed = await listResponse.json() as GmailMessageList;
    const items = listed.messages || [];

    const messages: GmailMessage[] = [];
    for (let start = 0; start < items.length; start += 10) {
      const batch = await Promise.all(items.slice(start, start + 10).map(async ({ id }) => {
        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
        return response.ok ? response.json() as Promise<GmailMessage> : null;
      }));
      messages.push(...batch.filter((message): message is GmailMessage => Boolean(message)));
    }

    const threadReplyStatus = new Map<string, boolean>();
    const threadIds = [...new Set(messages.map((message) => message.threadId))];
    for (let start = 0; start < threadIds.length; start += 10) {
      const batch = await Promise.all(threadIds.slice(start, start + 10).map(async (threadId) => {
        const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From`, { headers: { authorization: `Bearer ${accessToken}` }, cache: "no-store" });
        const thread = response.ok ? await response.json() as GmailThread : null;
        return [threadId, Boolean(thread?.messages?.some((item) => item.labelIds?.includes("SENT")))] as const;
      }));
      batch.forEach(([threadId, hasReply]) => threadReplyStatus.set(threadId, hasReply));
    }

    await Promise.all(messages.map((message) => {
      const subject = header(message, "Subject") || "(No subject)";
      const snippet = message.snippet || "";
      const receivedAt = message.internalDate ? new Date(Number(message.internalDate)) : null;
      const labelIds = message.labelIds || [];
      const isUnread = labelIds.includes("UNREAD");
      const threadHasReply = threadReplyStatus.get(message.threadId) || false;
      return prisma.gmailMessage.upsert({
        where: { gmailMessageId: message.id },
        update: { sender: header(message, "From"), subject, snippet, category: category(subject, snippet), labelIds, isUnread, threadHasReply, receivedAt },
        create: { userId: user.id, gmailMessageId: message.id, threadId: message.threadId, sender: header(message, "From"), subject, snippet, category: category(subject, snippet), labelIds, isUnread, threadHasReply, receivedAt },
      });
    }));
    const jobs = await prisma.job.findMany({ where: { userId: user.id }, select: { id: true, company: true, role: true } });
    let applicationConfirmations = 0;
    for (const message of messages) {
      const subject = header(message, "Subject") || "(No subject)";
      const snippet = message.snippet || "";
      if (category(subject, snippet) !== "APPLICATION") continue;
      const job = matchApplicationConfirmation(jobs, { sender: header(message, "From"), subject, snippet });
      if (!job) continue;
      const existing = await prisma.application.findUnique({ where: { userId_jobId: { userId: user.id, jobId: job.id } } });
      if (existing?.status === "NOT_PURSUING") continue;
      const appliedAt = message.internalDate ? new Date(Number(message.internalDate)) : new Date();
      await prisma.application.upsert({ where: { userId_jobId: { userId: user.id, jobId: job.id } }, update: { status: "APPLIED", appliedAt, notes: "Confirmed automatically from a Gmail application receipt." }, create: { userId: user.id, jobId: job.id, status: "APPLIED", appliedAt, notes: "Confirmed automatically from a Gmail application receipt." } });
      applicationConfirmations += 1;
    }
    await prisma.gmailConnection.update({ where: { userId: user.id }, data: { lastSyncedAt: new Date() } });
    return NextResponse.json({ scanned: items.length, synced: messages.length, applicationConfirmations, query: JOB_MAIL_QUERY });
  } catch (error) {
    console.error("[gmail] sync failed", error);
    return NextResponse.json({ error: "Gmail sync failed. Reconnect Gmail and try again." }, { status: 502 });
  }
}
