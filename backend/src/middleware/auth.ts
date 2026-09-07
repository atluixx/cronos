import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { fail } from "../lib/errors.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const userId = token ? verifyToken(token) : null;
  if (!userId) {
    fail(res, 401, "unauthorized", "Unauthorized");
    return;
  }

  // A validly-signed token can still point at a user that no longer exists
  // (e.g. the database was reset independently of issued tokens) — without
  // this check, every write for that "user" fails with an opaque FK error.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    fail(res, 401, "unauthorized", "Unauthorized");
    return;
  }

  req.userId = userId;
  next();
}
