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

export async function getCurrentUser() {
  return getCachedCurrentUser();
}

export const getUserProfileByAuthUserId = cache(async (authUserId: string) => {
  return loadUserProfileByAuthUserId({
    authUserId,
    context: "getUserProfileByAuthUserId",
  });
});

export async function requireUser(nextPath = "/home") {
  const user = await getCurrentUser();

  if (!user) {
    const sanitized = sanitizeRedirectPath(nextPath);
    const loginPath = resolveLoginPathForNext(sanitized);
    redirect(`${loginPath}?next=${encodeURIComponent(sanitized)}`);
  }

  return user;
}

export async function requireUserProfile(nextPath = "/home") {
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
    redirect("/home");
  }

  return { user: user as User, profile };
}
