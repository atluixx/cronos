import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { registerJob, unregisterJob } from "../scheduler/registerJob.js";
import { isValidSendAt } from "../scheduler/validation.js";
import { fail, failValidation } from "../lib/errors.js";

export const scheduledMessagesRouter = Router();
scheduledMessagesRouter.use(requireAuth);

class CodedError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const recurrenceSchema = z
  .string()
  .refine((v) => v === "DAILY" || /^WEEKLY:([A-Z]{3},?)+$/.test(v), "Invalid recurrence")
  .optional();

const createSchema = z.object({
  sessionId: z.string(),
  text: z.string().optional(),
  mediaPath: z.string().optional(),
  mediaType: z.enum(["IMAGE", "DOCUMENT"]).optional(),
  groupIds: z.array(z.string()).min(1, "Select at least one group"),
  sendAt: z.coerce.date(),
  recurrence: recurrenceSchema,
});

async function assertGroupsBelongToSession(userId: string, sessionId: string, groupIds: string[]) {
  const session = await prisma.whatsAppSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new CodedError("session_not_found", "Session not found");

  const groups = await prisma.group.findMany({ where: { id: { in: groupIds }, sessionId } });
  if (groups.length !== groupIds.length) {
    throw new CodedError("invalid_groups", "One or more groups do not belong to this session");
  }
  return session;
}

scheduledMessagesRouter.get("/", async (req: AuthedRequest, res) => {
  const { status, sessionId } = req.query as { status?: string; sessionId?: string };
  const messages = await prisma.scheduledMessage.findMany({
    where: {
      userId: req.userId,
      ...(status ? { status: status as any } : {}),
      ...(sessionId ? { sessionId } : {}),
    },
    include: { targets: { include: { group: true } } },
    orderBy: { sendAt: "asc" },
  });
  res.json(messages);
});

scheduledMessagesRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    failValidation(res, parsed.error.flatten());
    return;
  }
  const data = parsed.data;

  if (!data.text && !data.mediaPath) {
    fail(res, 400, "message_needs_content", "Message must have text and/or media");
    return;
  }
  if (!isValidSendAt(data.sendAt, data.recurrence)) {
    fail(res, 400, "send_at_in_past", "sendAt cannot be in the past for a one-time message");
    return;
  }

  try {
    await assertGroupsBelongToSession(req.userId!, data.sessionId, data.groupIds);
  } catch (err) {
    const coded = err as CodedError;
    fail(res, 400, coded.code ?? "action_failed", coded.message);
    return;
  }

  const message = await prisma.scheduledMessage.create({
    data: {
      userId: req.userId!,
      sessionId: data.sessionId,
      text: data.text,
      mediaPath: data.mediaPath,
      mediaType: data.mediaType,
      recurrence: data.recurrence,
      sendAt: data.sendAt,
      status: data.recurrence ? "ACTIVE" : "PENDING",
      targets: { create: data.groupIds.map((groupId) => ({ groupId })) },
    },
    include: { targets: true },
  });

  const bullJobId = await registerJob(message);
  await prisma.scheduledMessage.update({ where: { id: message.id }, data: { bullJobId } });

  res.status(201).json(message);
});

const updateSchema = z.object({
  text: z.string().optional(),
  mediaPath: z.string().nullable().optional(),
  mediaType: z.enum(["IMAGE", "DOCUMENT"]).nullable().optional(),
  groupIds: z.array(z.string()).min(1).optional(),
  sendAt: z.coerce.date().optional(),
  recurrence: recurrenceSchema.nullable(),
});

scheduledMessagesRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.scheduledMessage.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    fail(res, 404, "not_found", "Not found");
    return;
  }
  if (!["PENDING", "ACTIVE"].includes(existing.status)) {
    fail(res, 409, "cannot_edit", `Cannot edit a message with status ${existing.status}`);
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    failValidation(res, parsed.error.flatten());
    return;
  }
  const data = parsed.data;

  if (data.groupIds) {
    try {
      await assertGroupsBelongToSession(req.userId!, existing.sessionId, data.groupIds);
    } catch (err) {
      const coded = err as CodedError;
      fail(res, 400, coded.code ?? "action_failed", coded.message);
      return;
    }
    await prisma.messageTarget.deleteMany({ where: { scheduledMessageId: existing.id } });
    await prisma.messageTarget.createMany({
      data: data.groupIds.map((groupId) => ({ scheduledMessageId: existing.id, groupId })),
    });
  }

  const recurrence = data.recurrence === null ? null : (data.recurrence ?? existing.recurrence);
  const sendAt = data.sendAt ?? existing.sendAt;

  if (!isValidSendAt(sendAt, recurrence)) {
    fail(res, 400, "send_at_in_past", "sendAt cannot be in the past for a one-time message");
    return;
  }

  const updated = await prisma.scheduledMessage.update({
    where: { id: existing.id },
    data: {
      text: data.text ?? existing.text,
      mediaPath: data.mediaPath === null ? null : (data.mediaPath ?? existing.mediaPath),
      mediaType: data.mediaType === null ? null : (data.mediaType ?? existing.mediaType),
      sendAt,
      recurrence,
      status: recurrence ? "ACTIVE" : "PENDING",
    },
    include: { targets: true },
  });

  const bullJobId = await registerJob(updated);
  await prisma.scheduledMessage.update({ where: { id: updated.id }, data: { bullJobId } });

  res.json(updated);
});

scheduledMessagesRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.scheduledMessage.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    fail(res, 404, "not_found", "Not found");
    return;
  }
  await unregisterJob(existing);
  await prisma.scheduledMessage.update({ where: { id: existing.id }, data: { status: "CANCELLED" } });
  res.status(204).end();
});

scheduledMessagesRouter.get("/:id/logs", async (req: AuthedRequest, res) => {
  const existing = await prisma.scheduledMessage.findFirst({ where: { id: req.params.id, userId: req.userId } });
  if (!existing) {
    fail(res, 404, "not_found", "Not found");
    return;
  }
  const logs = await prisma.sendLog.findMany({
    where: { scheduledMessageId: existing.id },
    include: { group: { select: { name: true } } },
    orderBy: { attemptedAt: "desc" },
  });
  res.json(logs);
});
