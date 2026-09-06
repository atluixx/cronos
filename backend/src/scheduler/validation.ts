/**
 * A one-time (non-recurring) message must not be scheduled in the past.
 * Recurring messages are exempt: `sendAt` only supplies the time-of-day the
 * cron pattern fires at, not a single deadline.
 */
export function isValidSendAt(sendAt: Date, recurrence: string | null | undefined, now: Date = new Date()): boolean {
  if (recurrence) return true;
  return sendAt.getTime() >= now.getTime();
}
