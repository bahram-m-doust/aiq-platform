import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  ensureUserProfileExists,
  loadUserProfileByAuthUserId,
  logProfileProvisioningError,
  normalizeUserProfile,
  type UserProfileRow,
} from "@/features/auth/profile";
import type { UserProfile } from "@/features/auth/types";
import {
  resolveLoginPathForNext,
  sanitizeRedirectPath,
} from "@/features/auth/redirects";
import { isPlatformOwnerProfile } from "@/features/auth/roles";
import { isDevAuthBypassEnabled } from "@/lib/auth/dev-bypass";
import { ROUTES } from "@/lib/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAuthUser } from "@/lib/supabase/auth-user";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const getCachedCurrentUser = cache(async (): Promise<User | null> => {
  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  // resolveAuthUser guards getClaims() (which can throw during JWT decode /
  // WebCrypto verify, e.g. with ES256 signing keys) and falls back to a
  // server-side getUser() check instead of crashing the render with a 500.
  const authUser = await resolveAuthUser(supabase);

  if (!authUser) {
    return null;
  }

  return {
    id: authUser.id,
    email: authUser.email,
  } as User;
});

const getCachedVerifiedCurrentUser = cache(async () => {
  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
});

const devProfileColumns = "id, auth_user_id, email, full_name, global_role";

const getCachedDevAuthIdentity = cache(async (): Promise<{
  user: User;
  profile: UserProfile;
} | null> => {
  if (!isDevAuthBypassEnabled()) {
    return null;
  }

  const admin = createAdminClient();
  const configuredEmail = process.env.AIQ_DEV_AUTH_EMAIL?.trim().toLowerCase();
  let profileRow: UserProfileRow | null = null;

  if (configuredEmail) {
    const { data, error } = await admin
      .from("users_profile")
      .select(devProfileColumns)
      .eq("email", configuredEmail)
      .maybeSingle();

    if (error) {
      throw error;
    }

    profileRow = (data as UserProfileRow | null) ?? null;
  }

  if (!profileRow) {
    const { data: membership, error: membershipError } = await admin
      .from("brand_memberships")
      .select("user_id")
      .eq("status", "ACTIVE")
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      throw membershipError;
    }

    const userId =
      typeof membership === "object" &&
      membership !== null &&
      "user_id" in membership &&
      typeof membership.user_id === "string"
        ? membership.user_id
        : null;

    if (userId) {
      const { data, error } = await admin
        .from("users_profile")
        .select(devProfileColumns)
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      profileRow = (data as UserProfileRow | null) ?? null;
    }
  }

  if (!profileRow) {
    const { data, error } = await admin
      .from("users_profile")
      .select(devProfileColumns)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    profileRow = (data as UserProfileRow | null) ?? null;
  }

  if (!profileRow) {
    return null;
  }

  const profile = normalizeUserProfile(profileRow);
  const user = {
    id: profile.auth_user_id,
    email: profile.email,
  } as User;

  return { user, profile };
});

export async function getCurrentUser() {
  const user = await getCachedCurrentUser();

  if (user) {
    return user;
  }

  const devIdentity = await getCachedDevAuthIdentity();
  return devIdentity?.user ?? null;
}

export const getUserProfileByAuthUserId = cache(async (authUserId: string) => {
  return loadUserProfileByAuthUserId({
    authUserId,
    context: "getUserProfileByAuthUserId",
  });
});

export async function requireUser(nextPath: string = ROUTES.home) {
  const user = await getCurrentUser();

  if (!user) {
    const sanitized = sanitizeRedirectPath(nextPath);
    const loginPath = resolveLoginPathForNext(sanitized);
    redirect(`${loginPath}?next=${encodeURIComponent(sanitized)}`);
  }

  return user;
}

export async function requireUserProfile(nextPath: string = ROUTES.home) {
  const user = await requireUser(nextPath);
  const devIdentity = await getCachedDevAuthIdentity();

  if (devIdentity && user.id === devIdentity.user.id) {
    return devIdentity;
  }

  let profile = await getUserProfileByAuthUserId(user.id);

  if (!profile) {
    const verifiedUser = await getCachedVerifiedCurrentUser();

    if (!verifiedUser) {
      const sanitized = sanitizeRedirectPath(nextPath);
      const loginPath = resolveLoginPathForNext(sanitized);
      redirect(`${loginPath}?next=${encodeURIComponent(sanitized)}`);
    }

    try {
      profile = await ensureUserProfileExists(verifiedUser);
    } catch (error) {
      logProfileProvisioningError({
        context: "requireUserProfile",
        error,
        user: verifiedUser,
      });
      throw error;
    }

    return { user: verifiedUser, profile };
  }

  if (!profile) {
    throw new Error("Authenticated user profile could not be loaded.");
  }

  return { user, profile };
}

export async function requirePlatformOwner(nextPath = "/admin") {
  const { user, profile } = await requireUserProfile(nextPath);

  if (!isPlatformOwnerProfile(profile)) {
    redirect(ROUTES.home);
  }

  return { user: user as User, profile };
}
