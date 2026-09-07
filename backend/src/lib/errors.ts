import type { Response } from "express";

// Every error response carries a stable `code` alongside the human-readable
// `error` message, so the frontend can render a localized string instead of
// whatever language the backend happens to write its messages in.
export function fail(res: Response, status: number, code: string, message?: string) {
  res.status(status).json({ error: message ?? code, code });
}

export function failValidation(res: Response, flat: unknown) {
  res.status(400).json({ error: flat, code: "validation_error" });
}
