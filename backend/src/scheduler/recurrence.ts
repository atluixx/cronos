const WEEKDAY_TO_CRON: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Builds a cron expression from a base send time + a recurrence descriptor.
 * Supported recurrence strings: "DAILY" | "WEEKLY:MON,WED,FRI"
 */
export function toCronExpression(sendAt: Date, recurrence: string): string {
  const minute = sendAt.getUTCMinutes();
  const hour = sendAt.getUTCHours();

  if (recurrence === "DAILY") {
    return `${minute} ${hour} * * *`;
  }

  if (recurrence.startsWith("WEEKLY:")) {
    const days = recurrence
      .slice("WEEKLY:".length)
      .split(",")
      .map((d) => d.trim().toUpperCase())
      .filter((d) => d in WEEKDAY_TO_CRON)
      .map((d) => WEEKDAY_TO_CRON[d]);

    if (days.length === 0) throw new Error(`Invalid WEEKLY recurrence: ${recurrence}`);
    return `${minute} ${hour} * * ${days.join(",")}`;
  }

  throw new Error(`Unsupported recurrence: ${recurrence}`);
}
