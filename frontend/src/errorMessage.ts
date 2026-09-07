import type { TFunction } from "i18next";
import { ApiError } from "./api";

// Renders a caught error as a localized string: known backend error codes
// map to `errors.<code>` in the locale files; anything else (network errors,
// unmapped codes, validation-error objects) falls back to the raw message.
export function errorMessage(t: TFunction, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const code = err instanceof ApiError ? err.code : undefined;
  return code ? t(`errors.${code}`, { defaultValue: message }) : message;
}
