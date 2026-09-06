import fs from "node:fs";
import path from "node:path";
import { Worker } from "bullmq";
import type { AnyMessageContent } from "@whiskeysockets/baileys";
import { connection, QUEUE_NAME, type ScheduledMessageJobData } from "./queue.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { getSocket } from "../whatsapp/sessionManager.js";
import { broadcastToUser } from "../ws/hub.js";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildContent(message: { text: string | null; mediaPath: string | null; mediaType: string | null }): AnyMessageContent {
  if (message.mediaPath && message.mediaType) {
    const buffer = fs.readFileSync(message.mediaPath);
    if (message.mediaType === "IMAGE") {
      return { image: buffer, caption: message.text ?? undefined };
    }
    return {
      document: buffer,
      fileName: path.basename(message.mediaPath),
      mimetype: "application/octet-stream",
      caption: message.text ?? undefined,
    };
  }
  return { text: message.text ?? "" };
}

export const scheduledMessageWorker = new Worker<ScheduledMessageJobData>(
  QUEUE_NAME,
  async (job) => {
    const message = await prisma.scheduledMessage.findUnique({
      where: { id: job.data.scheduledMessageId },
      include: { targets: { include: { group: true } }, session: true },
    });
    if (!message || message.status === "CANCELLED") return;

    await prisma.scheduledMessage.update({ where: { id: message.id }, data: { status: "SENDING" } });

    const socket = getSocket(message.sessionId);
    if (!socket) {
      await prisma.scheduledMessage.update({
        where: { id: message.id },
        data: { status: message.recurrence ? "ACTIVE" : "FAILED" },
      });
      for (const target of message.targets) {
        await prisma.sendLog.create({
          data: { scheduledMessageId: message.id, groupId: target.groupId, success: false, errorMessage: "Session not connected" },
        });
      }
      return;
    }

    const content = buildContent(message);
    let successCount = 0;
    let failCount = 0;

    for (const [index, target] of message.targets.entries()) {
      // Small jitter between group sends: WhatsApp flags identical rapid-fire bursts as spam.
      if (index > 0) await delay(3000 + Math.random() * 2000);

      try {
        await socket.sendMessage(target.group.whatsappGroupId, content);
        await prisma.sendLog.create({ data: { scheduledMessageId: message.id, groupId: target.groupId, success: true } });
        successCount++;
        broadcastToUser(message.session.userId, "schedule:result", {
          scheduledMessageId: message.id,
          groupId: target.groupId,
          success: true,
        });
      } catch (err) {
        const errorMessage = (err as Error).message;
        await prisma.sendLog.create({
          data: { scheduledMessageId: message.id, groupId: target.groupId, success: false, errorMessage },
        });
        failCount++;
        broadcastToUser(message.session.userId, "schedule:result", {
          scheduledMessageId: message.id,
          groupId: target.groupId,
          success: false,
          errorMessage,
        });
      }
    }

    const finalStatus = message.recurrence
      ? "ACTIVE"
      : failCount === 0
        ? "SENT"
        : successCount === 0
          ? "FAILED"
          : "PARTIAL";

    await prisma.scheduledMessage.update({ where: { id: message.id }, data: { status: finalStatus } });
  },
  { connection },
);

scheduledMessageWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "Scheduled message job failed");
});
