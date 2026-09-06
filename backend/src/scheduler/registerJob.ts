import type { ScheduledMessage } from "@prisma/client";
import { scheduledMessageQueue } from "./queue.js";
import { toCronExpression } from "./recurrence.js";

/**
 * Registers (or re-registers) the BullMQ job backing a scheduled message.
 * One-time messages become a delayed job keyed by the message id.
 * Recurring messages become a BullMQ Job Scheduler keyed by the message id,
 * so create/edit/delete in the API maps 1:1 onto a single BullMQ entity.
 */
export async function registerJob(message: ScheduledMessage) {
  await unregisterJob(message);

  if (message.recurrence) {
    const cron = toCronExpression(message.sendAt, message.recurrence);
    await scheduledMessageQueue.upsertJobScheduler(
      message.id,
      { pattern: cron, tz: "UTC" },
      { name: "send", data: { scheduledMessageId: message.id } },
    );
    return message.id;
  }

  const delay = Math.max(0, message.sendAt.getTime() - Date.now());
  const job = await scheduledMessageQueue.add(
    "send",
    { scheduledMessageId: message.id },
    { jobId: message.id, delay },
  );
  return job.id!;
}

export async function unregisterJob(message: Pick<ScheduledMessage, "id" | "recurrence">) {
  if (message.recurrence) {
    await scheduledMessageQueue.removeJobScheduler(message.id);
  } else {
    const job = await scheduledMessageQueue.getJob(message.id);
    if (job) await job.remove();
  }
}
