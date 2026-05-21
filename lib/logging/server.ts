import "server-only";

const redactedValue = "[REDACTED]";
const maxStringLength = 500;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const sensitiveQueryPattern =
  /([?&](?:api_key|apikey|access_token|refresh_token|signature|sig|token)=)[^&\s]+/gi;

const sensitiveKeyNames = new Set([
  "apikey",
  "authorization",
  "content",
  "documentcontent",
  "email",
  "filecontent",
  "hash",
  "keyhash",
  "outputtext",
  "password",
  "prompt",
  "rawaccesskey",
  "rawkey",
  "secret",
  "servicerolekey",
  "signeddownloadurl",
  "signedurl",
  "targetemail",
  "token",
  "useremail",
  "answer",
]);

export type ServerLogJson =
  | null
  | string
  | number
  | boolean
  | ServerLogJson[]
  | { [key: string]: ServerLogJson };

function normalizedKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveServerLogKey(key: string) {
  const normalized = normalizedKey(key);

  return (
    sensitiveKeyNames.has(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("email") ||
    normalized.endsWith("password") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token") ||
    normalized.endsWith("signedurl") ||
    normalized.endsWith("filecontent") ||
    normalized.endsWith("documentcontent")
  );
}

function safeString(value: string) {
  const redacted = value
    .replace(emailPattern, redactedValue)
    .replace(sensitiveQueryPattern, `$1${redactedValue}`);

  return redacted.length > maxStringLength
    ? `${redacted.slice(0, maxStringLength)}...`
    : redacted;
}

function sanitizeLogValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): ServerLogJson {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return safeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    if (depth > 8) {
      return redactedValue;
    }

    return value.map((item) => sanitizeLogValue(item, seen, depth + 1));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return redactedValue;
    }

    if (depth > 8) {
      return redactedValue;
    }

    seen.add(value);

    return Object.entries(value).reduce<Record<string, ServerLogJson>>(
      (safeJson, [key, entryValue]) => {
        if (entryValue === undefined) {
          return safeJson;
        }

        safeJson[key] = isSensitiveServerLogKey(key)
          ? redactedValue
          : sanitizeLogValue(entryValue, seen, depth + 1);
        return safeJson;
      },
      {},
    );
  }

  return safeString(String(value));
}

export function sanitizeServerLogMetadata(value: unknown): ServerLogJson {
  return sanitizeLogValue(value, new WeakSet(), 0);
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
