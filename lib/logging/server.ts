import "server-only";

import {
  isSensitiveKey,
  sanitize,
  REDACTED,
  type SafeJson,
} from "@/lib/security/sanitize";

const maxStringLength = 500;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const sensitiveQueryPattern =
  /([?&](?:api_key|apikey|access_token|refresh_token|signature|sig|token)=)[^&\s]+/gi;

const LOG_EXTRA_KEYS = new Set([
  "email",
  "password",
  "useremail",
  "targetemail",
]);
const LOG_EXTRA_SUFFIXES = ["email", "password"];

export type ServerLogJson = SafeJson;

export function isSensitiveServerLogKey(key: string) {
  return isSensitiveKey(key, LOG_EXTRA_KEYS, LOG_EXTRA_SUFFIXES);
}

function safeString(value: string) {
  const redacted = value
    .replace(emailPattern, REDACTED)
    .replace(sensitiveQueryPattern, `$1${REDACTED}`);

  return redacted.length > maxStringLength
    ? `${redacted.slice(0, maxStringLength)}...`
    : redacted;
}

export function sanitizeServerLogMetadata(value: unknown): ServerLogJson {
  return sanitize(value, {
    maxDepth: 8,
    extraKeys: LOG_EXTRA_KEYS,
    extraSuffixes: LOG_EXTRA_SUFFIXES,
    transformString: safeString,
  });
}

export function summarizeServerError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: safeString(error.message),
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    return {
      name: typeof record.name === "string" ? record.name : "UnknownError",
      message:
        typeof record.message === "string"
          ? safeString(record.message)
          : "Unknown server error.",
      code: typeof record.code === "string" ? record.code : undefined,
      details:
        typeof record.details === "string"
          ? safeString(record.details)
          : undefined,
      hint: typeof record.hint === "string" ? safeString(record.hint) : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown server error.",
  };
}

export function logServerError({
  label,
  error,
  metadata,
}: {
  label: string;
  error: unknown;
  metadata?: Record<string, unknown>;
}) {
  console.error(
    label,
    sanitizeServerLogMetadata({
      ...(metadata ?? {}),
      error: summarizeServerError(error),
    }),
  );
}
