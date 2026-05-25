const REDACTED = "[REDACTED]";

const BASE_SENSITIVE_KEYS = new Set([
  "apikey",
  "authorization",
  "content",
  "documentcontent",
  "filecontent",
  "hash",
  "keyhash",
  "outputtext",
  "prompt",
  "rawaccesskey",
  "rawkey",
  "secret",
  "servicerolekey",
  "signeddownloadurl",
  "signedurl",
  "token",
  "answer",
]);

const SENSITIVE_SUFFIXES = [
  "apikey",
  "secret",
  "token",
  "signedurl",
  "filecontent",
  "documentcontent",
];

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveKey(
  key: string,
  extraKeys?: Set<string>,
  extraSuffixes?: string[],
) {
  const normalized = normalizeKey(key);
  if (BASE_SENSITIVE_KEYS.has(normalized)) return true;
  if (extraKeys?.has(normalized)) return true;
  for (const suffix of SENSITIVE_SUFFIXES) {
    if (normalized.endsWith(suffix)) return true;
  }
  if (extraSuffixes) {
    for (const suffix of extraSuffixes) {
      if (normalized.endsWith(suffix)) return true;
    }
  }
  return false;
}

export type SafeJson =
  | null
  | string
  | number
  | boolean
  | SafeJson[]
  | { [key: string]: SafeJson };

export type SanitizeOptions = {
  maxDepth: number;
  extraKeys?: Set<string>;
  extraSuffixes?: string[];
  transformString?: (value: string) => string;
};

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
  options: SanitizeOptions,
): SafeJson {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    return options.transformString ? options.transformString(value) : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    if (depth > options.maxDepth) return REDACTED;
    return value.map((item) => sanitizeValue(item, seen, depth + 1, options));
  }

  if (typeof value === "object") {
    if (seen.has(value) || depth > options.maxDepth) return REDACTED;
    seen.add(value);

    return Object.entries(value).reduce<Record<string, SafeJson>>(
      (safe, [key, v]) => {
        if (v === undefined) return safe;
        safe[key] = isSensitiveKey(key, options.extraKeys, options.extraSuffixes)
          ? REDACTED
          : sanitizeValue(v, seen, depth + 1, options);
        return safe;
      },
      {},
    );
  }

  const str = String(value);
  return options.transformString ? options.transformString(str) : str;
}

export function sanitize(value: unknown, options: SanitizeOptions): SafeJson {
  return sanitizeValue(value, new WeakSet(), 0, options);
}

export { REDACTED };
