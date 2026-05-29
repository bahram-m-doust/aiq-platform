export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export function isDomainErrorWithCode(
  error: unknown,
  code: string,
): error is DomainError {
  return isDomainError(error) && error.code === code;
}

// Postgres / PostgREST errors from @supabase/supabase-js arrive as plain
// objects ({ code, details, hint, message }), not Error instances. When the
// app throws them as-is, Next.js's error overlay renders them as the
// truncated "{code: ..., message: ...}" blob. wrapSupabaseError converts the
// blob into a real Error whose message includes the SQLSTATE, hint, and
// details — so the dev overlay (and server logs) show what actually failed
// (e.g. 42703 undefined_column on brands.icon_path).
type SupabaseLikeError = {
  message?: string;
  code?: string;
  hint?: string | null;
  details?: string | null;
};

export function wrapSupabaseError(
  error: unknown,
  context: string,
): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === "object") {
    const e = error as SupabaseLikeError;
    const parts = [
      e.code ? `[${e.code}]` : null,
      e.message ?? null,
      e.details ? `details: ${e.details}` : null,
      e.hint ? `hint: ${e.hint}` : null,
    ].filter(Boolean);
    const wrapped = new Error(`${context}: ${parts.join(" — ")}`);
    wrapped.name = "SupabaseError";
    return wrapped;
  }
  return new Error(`${context}: ${String(error)}`);
}
