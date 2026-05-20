import "server-only";

import type { User } from "@supabase/supabase-js";

import { toUserProfileInsert } from "@/features/auth/profile-mapping";
import type { GlobalRole, UserProfile } from "@/features/auth/types";
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

function getMetadataFullName(user: User) {
  const metadataFullName = user.user_metadata?.full_name;

  return typeof metadataFullName === "string" && metadataFullName.trim()
    ? metadataFullName.trim()
    : null;
}

function getNormalizedEmail(user: User) {
  const email = user.email?.trim().toLowerCase();

  return email || null;
}

function errorSummary(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;

    return {
      name: typeof record.name === "string" ? record.name : "UnknownError",
      message:
        typeof record.message === "string"
          ? record.message
          : "Unknown profile provisioning error.",
      code: typeof record.code === "string" ? record.code : undefined,
      details:
        typeof record.details === "string" ? record.details : undefined,
      hint: typeof record.hint === "string" ? record.hint : undefined,
    };
  }

  return {
    name: "UnknownError",
    message: "Unknown profile provisioning error.",
  };
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
  console.error("[auth.profile] profile query failed", {
    context,
    table,
    action,
    query,
    auth_user_id: authUserId,
    email_present: emailPresent,
    error: errorSummary(error),
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
  console.error("[auth.profile] profile provisioning failed", {
    context,
    auth_user_id: user?.id ?? null,
    email_present: Boolean(user?.email),
    error: errorSummary(error),
  });
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
  const { data, error } = await admin
    .from("users_profile")
    .select(profileColumns)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

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
    const { data, error } = await admin
      .from("users_profile")
      .update(update)
      .eq("auth_user_id", authUserId)
      .select(profileColumns)
      .single();

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

    const { data, error: retryError } = await admin
      .from("users_profile")
      .update(retryUpdate)
      .eq("auth_user_id", authUserId)
      .select(profileColumns)
      .single();

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
  const fullName = getMetadataFullName(user);

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

  const insert = toUserProfileInsert(user);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users_profile")
    .upsert(insert, {
      onConflict: "auth_user_id",
    })
    .select(profileColumns)
    .single();

  if (error) {
    logProfileQueryError({
      context: "ensureUserProfile.upsert",
      table: "users_profile",
      action: "upsert",
      query: "users_profile.upsert.on_auth_user_id",
      authUserId,
      emailPresent: Boolean(email),
      error,
    });
    const fallbackProfile = await loadUserProfileByAuthUserId({
      authUserId,
      context: "ensureUserProfile.upsertFallbackSelect",
      emailPresent: Boolean(email),
    });

    if (fallbackProfile) {
      return fallbackProfile;
    }

    throw error;
  }

  return normalizeUserProfile(data as UserProfileRow);
}
