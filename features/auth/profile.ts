import "server-only";

import type { User } from "@supabase/supabase-js";

import {
  extractFullName,
  toUserProfileInsert,
} from "@/features/auth/profile-mapping";
import type { GlobalRole, UserProfile } from "@/features/auth/types";
import { logServerError, summarizeServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

const profileColumns = "id, auth_user_id, email, full_name, global_role";

export type UserProfileRow = Omit<UserProfile, "global_role"> & {
  global_role: GlobalRole | null;
};

type ProfileQueryContext = {
  context: string;
  table: "users_profile";
  action: string;
  query: string;
  authUserId: string | null;
  emailPresent: boolean;
};

function getNormalizedEmail(user: User) {
  const email = user.email?.trim().toLowerCase();

  return email || null;
}

function errorSummary(error: unknown) {
  return summarizeServerError(error);
}

export function logProfileQueryError({
  context,
  table,
  action,
  query,
  authUserId,
  emailPresent,
  error,
}: ProfileQueryContext & {
  error: unknown;
}) {
  logServerError({
    label: "[auth.profile] profile query failed",
    error,
    metadata: {
      context,
      table,
      action,
      query,
      auth_user_id: authUserId,
      email_present: emailPresent,
    },
  });
}

function isMissingUpdatedAtColumn(error: unknown) {
  const summary = errorSummary(error);

  return (
    summary.code === "PGRST204" &&
    typeof summary.message === "string" &&
    summary.message.includes("updated_at")
  );
}

export function logProfileProvisioningError({
  context,
  error,
  user,
}: {
  context: string;
  error: unknown;
  user: Pick<User, "id" | "email"> | null;
}) {
  logServerError({
    label: "[auth.profile] profile provisioning failed",
    error,
    metadata: {
      context,
      auth_user_id: user?.id ?? null,
      email_present: Boolean(user?.email),
    },
  });
}

export function describeProfileProvisioningError(error: unknown): string {
  const summary = errorSummary(error);
  const code =
    "code" in summary && typeof summary.code === "string" ? summary.code : null;
  const message =
    typeof summary.message === "string" ? summary.message : "Unknown error.";

  // The detailed remediation hints below name env vars, SQL commands and raw
  // DB error text — invaluable while setting the project up, but they must not
  // reach end users in production. Operators get the details from the server
  // log (logProfileProvisioningError) instead.
  if (process.env.NODE_ENV === "production") {
    return "Your account could not be prepared. Please try again, or contact support if the problem persists.";
  }

  if (code === "42P01") {
    return "Database is not set up: the users_profile table is missing. Apply Supabase migrations 0001–0006.";
  }
  if (code === "42703") {
    return `Database schema is out of date (missing column). ${message}`;
  }
  if (code === "23514") {
    return `users_profile constraint failed (role check). ${message}`;
  }
  if (code === "23505") {
    return `Duplicate users_profile record. ${message}`;
  }
  if (code === "42501" || code === "PGRST301") {
    return "Service role key is invalid or missing — check SUPABASE_SERVICE_ROLE_KEY.";
  }
  if (code === "PGRST002") {
    return "Supabase PostgREST schema cache is stale. Run `NOTIFY pgrst, 'reload schema';` in the SQL editor, or restart the project under Settings → General.";
  }
  return code ? `${message} (code ${code})` : message;
}

function getErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return null;
}

const PGRST_SCHEMA_CACHE_CODE = "PGRST002";

type SupabaseQueryResult<T> = { data: T; error: unknown };

async function withSchemaCacheRetry<T>(
  operation: () => PromiseLike<SupabaseQueryResult<T>>,
): Promise<SupabaseQueryResult<T>> {
  const delaysMs = [200, 800, 2400];

  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    const result = await operation();
    if (getErrorCode(result.error) !== PGRST_SCHEMA_CACHE_CODE) {
      return result;
    }
    if (attempt === delaysMs.length) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
  }

  return operation();
}

export function normalizeUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    auth_user_id: row.auth_user_id,
    email: row.email,
    full_name: row.full_name,
    global_role: row.global_role ?? "REGISTERED_USER",
  };
}

export async function loadUserProfileByAuthUserId({
  authUserId,
  context,
  emailPresent = false,
}: {
  authUserId: string;
  context: string;
  emailPresent?: boolean;
}) {
  const admin = createAdminClient();
  const { data, error } = await withSchemaCacheRetry(() =>
    admin
      .from("users_profile")
      .select(profileColumns)
      .eq("auth_user_id", authUserId)
      .maybeSingle(),
  );

  if (error) {
    logProfileQueryError({
      context,
      table: "users_profile",
      action: "select",
      query: "users_profile.select.by_auth_user_id",
      authUserId,
      emailPresent,
      error,
    });
    throw error;
  }

  return data ? normalizeUserProfile(data as UserProfileRow) : null;
}

async function createMissingProfile({
  user,
  context,
}: {
  user: User;
  context: string;
}): Promise<UserProfile> {
  const authUserId = user.id;
  const email = getNormalizedEmail(user);
  const insert = toUserProfileInsert(user);
  const admin = createAdminClient();
  const { data, error } = await withSchemaCacheRetry(() =>
    admin
      .from("users_profile")
      .upsert(insert, {
        onConflict: "auth_user_id",
      })
      .select(profileColumns)
      .single(),
  );

  if (error) {
    logProfileQueryError({
      context: `${context}.upsert`,
      table: "users_profile",
      action: "upsert",
      query: "users_profile.upsert.on_auth_user_id",
      authUserId,
      emailPresent: Boolean(email),
      error,
    });
    const fallbackProfile = await loadUserProfileByAuthUserId({
      authUserId,
      context: `${context}.upsertFallbackSelect`,
      emailPresent: Boolean(email),
    });

    if (fallbackProfile) {
      return fallbackProfile;
    }

    throw error;
  }

  return normalizeUserProfile(data as UserProfileRow);
}

async function updateExistingProfile({
  authUserId,
  email,
  fullName,
}: {
  authUserId: string;
  email: string | null;
  fullName: string | null;
}) {
  const admin = createAdminClient();
  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if (email) {
    update.email = email;
  }

  if (fullName) {
    update.full_name = fullName;
  }

  try {
    const { data, error } = await withSchemaCacheRetry(() =>
      admin
        .from("users_profile")
        .update(update)
        .eq("auth_user_id", authUserId)
        .select(profileColumns)
        .single(),
    );

    if (error) {
      throw error;
    }

    return normalizeUserProfile(data as UserProfileRow);
  } catch (error) {
    if (!isMissingUpdatedAtColumn(error)) {
      throw error;
    }

    const retryUpdate = { ...update };
    delete retryUpdate.updated_at;

    if (Object.keys(retryUpdate).length === 0) {
      const profile = await loadUserProfileByAuthUserId({
        authUserId,
        context: "updateExistingProfile.retrySelect",
        emailPresent: Boolean(email),
      });

      if (!profile) {
        throw error;
      }

      return profile;
    }

    const { data, error: retryError } = await withSchemaCacheRetry(() =>
      admin
        .from("users_profile")
        .update(retryUpdate)
        .eq("auth_user_id", authUserId)
        .select(profileColumns)
        .single(),
    );

    if (retryError) {
      throw retryError;
    }

    return normalizeUserProfile(data as UserProfileRow);
  }
}

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const authUserId = user.id;

  if (!authUserId) {
    throw new Error("Authenticated user is missing an id.");
  }

  const email = getNormalizedEmail(user);
  const existingProfile = await loadUserProfileByAuthUserId({
    authUserId,
    context: "ensureUserProfile.initialSelect",
    emailPresent: Boolean(email),
  });
  const fullName = extractFullName(user);

  if (existingProfile) {
    try {
      return await updateExistingProfile({
        authUserId,
        email,
        fullName,
      });
    } catch (error) {
      logProfileQueryError({
        context: "ensureUserProfile.existingProfileRefresh",
        table: "users_profile",
        action: "update",
        query: "users_profile.update.by_auth_user_id",
        authUserId,
        emailPresent: Boolean(email),
        error,
      });
      return existingProfile;
    }
  }

  return createMissingProfile({
    user,
    context: "ensureUserProfile",
  });
}

export async function ensureUserProfileExists(
  user: User,
): Promise<UserProfile> {
  const authUserId = user.id;

  if (!authUserId) {
    throw new Error("Authenticated user is missing an id.");
  }

  const email = getNormalizedEmail(user);
  const existingProfile = await loadUserProfileByAuthUserId({
    authUserId,
    context: "ensureUserProfileExists.initialSelect",
    emailPresent: Boolean(email),
  });

  if (existingProfile) {
    return existingProfile;
  }

  return createMissingProfile({
    user,
    context: "ensureUserProfileExists",
  });
}
