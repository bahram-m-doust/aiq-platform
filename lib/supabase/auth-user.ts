import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedAuthUser = {
  id: string;
  email?: string;
};

async function resolveViaGetUser(
  supabase: SupabaseClient,
): Promise<ResolvedAuthUser | null> {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return { id: user.id, email: user.email ?? undefined };
  } catch {
    return null;
  }
}

/**
 * Resolve the authenticated user from a Supabase client without ever letting a
 * verification failure crash the request.
 *
 * We prefer `getClaims()` because it verifies the JWT locally (fast, no network
 * round-trip). But `getClaims()` can THROW a non-auth error — not just return
 * `{ error }` — while decoding the JWT or running the WebCrypto signature check.
 * That happens, for example, after a project migrates to asymmetric (ES256)
 * JWT signing keys, or when a session cookie is malformed/stale. An unguarded
 * `getClaims()` in middleware therefore surfaces as a raw "Internal Server
 * Error" on every authenticated page.
 *
 * Strategy:
 *  - No session (clean `{ error: null }`, no `sub`) → return null (anonymous).
 *  - `getClaims()` returns an auth error, or throws → fall back to `getUser()`,
 *    which validates the token against the Auth server (it knows the signing
 *    keys), so genuinely-valid sessions are preserved and only truly-invalid
 *    ones are treated as signed out.
 */
export async function resolveAuthUser(
  supabase: SupabaseClient,
): Promise<ResolvedAuthUser | null> {
  try {
    const { data, error } = await supabase.auth.getClaims();

    if (!error) {
      const sub = data?.claims?.sub;
      return sub ? { id: String(sub), email: claimsEmail(data?.claims) } : null;
    }
  } catch {
    // getClaims threw (JWT decode / WebCrypto verify) — fall through to the
    // server-side check below instead of crashing the request.
  }

  return resolveViaGetUser(supabase);
}

function claimsEmail(claims: Record<string, unknown> | null | undefined) {
  const email = claims?.email;
  return typeof email === "string" && email ? email : undefined;
}
