import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import {
  ensureUserProfile,
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

export async function getCurrentUser() {
  if (!hasPublicSupabaseEnv()) {
    return null;
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function getUserProfileByAuthUserId(authUserId: string) {
  return loadUserProfileByAuthUserId({
    authUserId,
    context: "getUserProfileByAuthUserId",
  });
}

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
    try {
      profile = await ensureUserProfile(user);
    } catch (error) {
      logProfileProvisioningError({
        context: "requireUserProfile",
        error,
        user,
      });
      throw error;
    }
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
