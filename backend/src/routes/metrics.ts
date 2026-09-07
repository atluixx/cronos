import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { failValidation, fail } from "../lib/errors.js";

export const metricsRouter = Router();
metricsRouter.use(requireAuth);

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function utcMidnight(isoDateString: string): Date {
  return new Date(`${isoDateString}T00:00:00.000Z`);
}

// Earliest thing the user has ever done with the product — first number
// added, or first send if somehow earlier — so the frontend can default the
// metrics range to "since I started using this" instead of a fixed lookback
// that includes days before the account existed.
metricsRouter.get("/first-activity", async (req: AuthedRequest, res) => {
  const [firstSession, firstLog] = await Promise.all([
    prisma.whatsAppSession.findFirst({
      where: { userId: req.userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.sendLog.findFirst({
      where: { scheduledMessage: { userId: req.userId } },
      orderBy: { attemptedAt: "asc" },
      select: { attemptedAt: true },
    }),
  ]);
  const dates = [firstSession?.createdAt, firstLog?.attemptedAt].filter((d): d is Date => Boolean(d));
  const earliest = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  res.json({ date: earliest ? dayKey(earliest) : null });
});

// Per-day send volume across all of the user's sessions, for the delivery chart.
// Accepts an explicit `from`/`to` (YYYY-MM-DD) range, or falls back to the last
// `days` days ending today when no range is given.
metricsRouter.get("/daily", async (req: AuthedRequest, res) => {
  const parsed = z
    .object({
      from: isoDate.optional(),
      to: isoDate.optional(),
      days: z.coerce.number().int().min(1).max(MAX_RANGE_DAYS).optional(),
    })
    .safeParse(req.query);
  if (!parsed.success) {
    failValidation(res, parsed.error.flatten());
    return;
  }

  let rangeStart: Date;
  let rangeEnd: Date;
  if (parsed.data.from && parsed.data.to) {
    rangeStart = utcMidnight(parsed.data.from);
    rangeEnd = utcMidnight(parsed.data.to);
    if (rangeEnd < rangeStart) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
  } else {
    const days = parsed.data.days ?? 14;
    const now = new Date();
    rangeEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    rangeStart = new Date(rangeEnd.getTime() - (days - 1) * DAY_MS);
  }

  const dayCount = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / DAY_MS) + 1;
  if (dayCount > MAX_RANGE_DAYS) {
    fail(res, 400, "range_too_large", `Range cannot exceed ${MAX_RANGE_DAYS} days`);
    return;
  }

  const logs = await prisma.sendLog.findMany({
    where: { scheduledMessage: { userId: req.userId }, attemptedAt: { gte: rangeStart, lt: new Date(rangeEnd.getTime() + DAY_MS) } },
    select: { attemptedAt: true, success: true },
  });

  const buckets = new Map<string, { sent: number; failed: number }>();
  for (let i = 0; i < dayCount; i++) {
    buckets.set(dayKey(new Date(rangeStart.getTime() + i * DAY_MS)), { sent: 0, failed: 0 });
  }
  for (const log of logs) {
    const bucket = buckets.get(dayKey(log.attemptedAt));
    if (!bucket) continue;
    if (log.success) bucket.sent += 1;
    else bucket.failed += 1;
  }

  res.json([...buckets.entries()].map(([date, counts]) => ({ date, ...counts })));
});

// Groups ranked by successful send volume, for the "top groups" list.
metricsRouter.get("/top-groups", async (req: AuthedRequest, res) => {
  const parsed = z
    .object({ limit: z.coerce.number().int().min(1).max(50).optional() })
    .safeParse(req.query);
  if (!parsed.success) {
    failValidation(res, parsed.error.flatten());
    return;
  }
  const limit = parsed.data.limit ?? 5;

  const grouped = await prisma.sendLog.groupBy({
    by: ["groupId"],
    where: { scheduledMessage: { userId: req.userId }, success: true },
    _count: { _all: true },
    orderBy: { _count: { groupId: "desc" } },
    take: limit,
  });

  const groups = await prisma.group.findMany({
    where: { id: { in: grouped.map((g) => g.groupId) } },
    select: { id: true, name: true, participantCount: true },
  });
  const byId = new Map(groups.map((g) => [g.id, g]));

  res.json(
    grouped.map((g) => ({
      groupId: g.groupId,
      name: byId.get(g.groupId)?.name ?? "—",
      participantCount: byId.get(g.groupId)?.participantCount ?? null,
      sent: g._count._all,
    })),
  );
});
