import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { startSession, logoutSession, refreshGroups } from "../whatsapp/sessionManager.js";
import { unregisterJob } from "../scheduler/registerJob.js";

export const sessionsRouter = Router();
sessionsRouter.use(requireAuth);

sessionsRouter.get("/", async (req: AuthedRequest, res) => {
  const sessions = await prisma.whatsAppSession.findMany({
    where: { userId: req.userId, removedAt: null },
    select: {
      id: true,
      label: true,
      phoneNumber: true,
      status: true,
      lastConnectedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  res.json(sessions);
});

sessionsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = z.object({ label: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const session = await prisma.whatsAppSession.create({
    data: { userId: req.userId!, label: parsed.data.label },
  });
  res.status(201).json(session);
});

async function ownedSession(userId: string, sessionId: string) {
  return prisma.whatsAppSession.findFirst({ where: { id: sessionId, userId, removedAt: null } });
}

sessionsRouter.post("/:id/link/qr", async (req: AuthedRequest, res) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await startSession(session.id, req.userId!, { method: "qr" });
  res.status(202).json({ status: "starting" });
});

sessionsRouter.post("/:id/link/pairing-code", async (req: AuthedRequest, res) => {
  const parsed = z.object({ phoneNumber: z.string().min(6) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await startSession(session.id, req.userId!, { method: "pairing", phoneNumber: parsed.data.phoneNumber });
  res.status(202).json({ status: "starting" });
});

sessionsRouter.get("/:id/status", async (req: AuthedRequest, res) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json({ status: session.status });
});

// Soft-delete: logs the device out of WhatsApp and wipes local auth/session state,
// but keeps the WhatsAppSession row (marked removed) plus its scheduled messages
// and send logs so history survives unlinking a number.
sessionsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await logoutSession(session.id);

  const activeMessages = await prisma.scheduledMessage.findMany({
    where: { sessionId: session.id, status: { in: ["PENDING", "ACTIVE"] } },
  });
  for (const message of activeMessages) {
    await unregisterJob(message);
    await prisma.scheduledMessage.update({ where: { id: message.id }, data: { status: "CANCELLED" } });
  }

  await prisma.whatsAppSession.update({
    where: { id: session.id },
    data: { status: "REMOVED", removedAt: new Date(), authState: Prisma.JsonNull },
  });

  res.status(204).end();
});

sessionsRouter.get("/:id/groups", async (req: AuthedRequest, res) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const groups = await prisma.group.findMany({
    where: { sessionId: session.id },
    select: { id: true, name: true, participantCount: true, lastSyncedAt: true, whatsappGroupId: true },
    orderBy: { name: "asc" },
  });
  res.json(groups);
});

sessionsRouter.post("/:id/groups/refresh", async (req: AuthedRequest, res) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  try {
    const groups = await refreshGroups(session.id);
    res.json(groups);
  } catch (err) {
    res.status(409).json({ error: (err as Error).message });
  }
});

const DAY_MS = 24 * 60 * 60 * 1000;

sessionsRouter.get("/:id/stats", async (req: AuthedRequest, res) => {
  const session = await ownedSession(req.userId!, req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const now = new Date();
  const last7Days = new Date(now.getTime() - 7 * DAY_MS);
  const last30Days = new Date(now.getTime() - 30 * DAY_MS);

  const scheduledMessageFilter = { scheduledMessage: { sessionId: session.id } } as const;

  const [totalSent, totalFailed, sentThisWeek, sentThisMonth, groupsCount, lastLog] = await Promise.all([
    prisma.sendLog.count({ where: { ...scheduledMessageFilter, success: true } }),
    prisma.sendLog.count({ where: { ...scheduledMessageFilter, success: false } }),
    prisma.sendLog.count({ where: { ...scheduledMessageFilter, success: true, attemptedAt: { gte: last7Days } } }),
    prisma.sendLog.count({ where: { ...scheduledMessageFilter, success: true, attemptedAt: { gte: last30Days } } }),
    prisma.group.count({ where: { sessionId: session.id } }),
    prisma.sendLog.findFirst({
      where: scheduledMessageFilter,
      orderBy: { attemptedAt: "desc" },
      select: { attemptedAt: true },
    }),
  ]);

  res.json({
    totalSent,
    totalFailed,
    sentThisWeek,
    sentThisMonth,
    groupsCount,
    lastActivityAt: lastLog?.attemptedAt ?? session.lastConnectedAt,
  });
});
