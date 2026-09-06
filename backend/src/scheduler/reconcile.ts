import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { registerJob } from "./registerJob.js";

/**
 * On boot, re-registers any PENDING/ACTIVE schedule so restarts never silently
 * drop a job — BullMQ jobs live in Redis, which can be wiped independently of the DB.
 */
export async function reconcileScheduledJobs() {
  const pending = await prisma.scheduledMessage.findMany({
    where: { status: { in: ["PENDING", "ACTIVE"] } },
  });

  for (const message of pending) {
    try {
      const jobId = await registerJob(message);
      if (jobId !== message.bullJobId) {
        await prisma.scheduledMessage.update({ where: { id: message.id }, data: { bullJobId: jobId } });
      }
    } catch (err) {
      logger.error({ scheduledMessageId: message.id, err }, "Failed to reconcile scheduled job");
    }
  }

  logger.info({ count: pending.length }, "Reconciled scheduled jobs on boot");
}
