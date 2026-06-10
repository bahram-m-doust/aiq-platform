import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// True when `value` is a syntactically valid UUID. Use before passing a value
// into a Supabase `.eq("id", …)` / `.in("id", […])` against a uuid column —
// Postgres rejects non-UUID text with error 22P02 (invalid_text_representation),
// which otherwise crashes the request.
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value)
}
