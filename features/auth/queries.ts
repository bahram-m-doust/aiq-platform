import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  ensureUserProfileExists,
  loadUserProfileByAuthUserId,
  logProfileProvisioningError,
} from "@/features/auth/profile";
import {
  resolveLoginPathForNext,
  sanitizeRedirectPath,
} from "@/features/auth/redirects";
import { isPlatformOwnerProfile } from "@/features/auth/roles";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function claimString(
  claims: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = claims?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const getCachedCurrentUser = cache(async (): Promise<User | null> => {
  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return null;
  }

  const claims = claimsData.claims as Record<string, unknown>;
  return {
    id: String(claimsData.claims.sub),
    email: claimString(claims, "email"),
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

export async function getCurrentUser() {
  return getCachedCurrentUser();
}

export const getUserProfileByAuthUserId = cache(async (authUserId: string) => {
  return loadUserProfileByAuthUserId({
    authUserId,
    context: "getUserProfileByAuthUserId",
  });
});

export async function requireUser(nextPath = "/dashboard") {
  const user = await getCurrentUser();

  if (!user) {
    const sanitized = sanitizeRedirectPath(nextPath);
    const loginPath = resolveLoginPathForNext(sanitized);
    redirect(`${loginPath}?next=${encodeURIComponent(sanitized)}`);
  }

  return user;
}

export async function requireUserProfile(nextPath = "/dashboard") {
  const user = await requireUser(nextPath);
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
    redirect("/dashboard");
  }

  return { user: user as User, profile };
}
