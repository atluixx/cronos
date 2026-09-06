import { Queue } from "bullmq";
import { Redis } from "ioredis";

export const connection = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
});

export const QUEUE_NAME = "scheduled-messages";

export const scheduledMessageQueue = new Queue(QUEUE_NAME, { connection });

export interface ScheduledMessageJobData {
  scheduledMessageId: string;
}
