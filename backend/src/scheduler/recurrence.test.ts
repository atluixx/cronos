import { describe, expect, it } from "vitest";
import { toCronExpression } from "./recurrence.js";

describe("toCronExpression", () => {
  it("builds a daily cron pattern from the UTC time-of-day", () => {
    const sendAt = new Date(Date.UTC(2026, 0, 1, 14, 30));
    expect(toCronExpression(sendAt, "DAILY")).toBe("30 14 * * *");
  });

  it("builds a weekly cron pattern for a single weekday", () => {
    const sendAt = new Date(Date.UTC(2026, 0, 1, 9, 0));
    expect(toCronExpression(sendAt, "WEEKLY:MON")).toBe("0 9 * * 1");
  });

  it("builds a weekly cron pattern for multiple weekdays, mapping names to cron day numbers", () => {
    const sendAt = new Date(Date.UTC(2026, 0, 1, 8, 5));
    expect(toCronExpression(sendAt, "WEEKLY:SUN,WED,SAT")).toBe("5 8 * * 0,3,6");
  });

  it("is case-insensitive on weekday names", () => {
    const sendAt = new Date(Date.UTC(2026, 0, 1, 8, 0));
    expect(toCronExpression(sendAt, "WEEKLY:mon,fri")).toBe("0 8 * * 1,5");
  });

  it("throws on a WEEKLY recurrence with no recognizable days", () => {
    const sendAt = new Date();
    expect(() => toCronExpression(sendAt, "WEEKLY:")).toThrow();
    expect(() => toCronExpression(sendAt, "WEEKLY:XYZ")).toThrow();
  });

  it("throws on an unsupported recurrence string", () => {
    const sendAt = new Date();
    expect(() => toCronExpression(sendAt, "MONTHLY")).toThrow();
    expect(() => toCronExpression(sendAt, "")).toThrow();
  });
});
