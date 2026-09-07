// The "min" build ships only the metadata needed for parsing/formatting
// (no extended validation data), which is ~90% smaller than the full package.
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

// WhatsApp/Baileys numbers come back as bare digits (e.g. "393276624337"),
// not E.164 — format them per the number's own country so an Italian number
// reads "+39 327 662 4337" instead of a raw digit string.
export function formatPhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return raw ?? null;
  const withPlus = raw.startsWith("+") ? raw : `+${raw}`;
  const parsed = parsePhoneNumberFromString(withPlus);
  return parsed ? parsed.formatInternational() : raw;
}
