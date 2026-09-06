import { describe, expect, it } from "vitest";
import { isValidSendAt } from "./validation.js";

describe("isValidSendAt", () => {
  const now = new Date("2026-09-06T12:00:00Z");

  it("rejects a one-time send time in the past", () => {
    const past = new Date("2026-09-06T11:59:59Z");
    expect(isValidSendAt(past, null, now)).toBe(false);
    expect(isValidSendAt(past, undefined, now)).toBe(false);
  });

  it("accepts a one-time send time in the future", () => {
    const future = new Date("2026-09-06T12:00:01Z");
    expect(isValidSendAt(future, null, now)).toBe(true);
  });

  it("accepts the exact current instant as valid (boundary)", () => {
    expect(isValidSendAt(now, null, now)).toBe(true);
  });

  it("always accepts a recurring message regardless of sendAt", () => {
    const past = new Date("2020-01-01T00:00:00Z");
    expect(isValidSendAt(past, "DAILY", now)).toBe(true);
    expect(isValidSendAt(past, "WEEKLY:MON", now)).toBe(true);
  });
});
