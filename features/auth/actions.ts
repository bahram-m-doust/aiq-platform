"use server";

import { redirect } from "next/navigation";

import {
  describeProfileProvisioningError,
  ensureUserProfile,
  logProfileProvisioningError,
} from "@/features/auth/profile";
import { getTrustedRequestOrigin } from "@/features/auth/origins";
import { sanitizeRedirectPath } from "@/features/auth/redirects";
import {
  validateLoginFormData,
  validateRegistrationFormData,
} from "@/features/auth/schemas";
import type { AuthFormState } from "@/features/auth/types";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

function errorState(message: string): AuthFormState {
  return { status: "error", message };
}

export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validateLoginFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid login details.");
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "auth.login",
    identifiers: [validation.data.email],
    limit: 10,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    return errorState(RATE_LIMITED_MESSAGE);
  }

  const nextPath = sanitizeRedirectPath(formData.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(
    validation.data,
  );

  if (error || !data.user) {
    return errorState("Invalid email or password.");
  }

  try {
    await ensureUserProfile(data.user);
  } catch (error) {
    logProfileProvisioningError({
      context: "login",
      error,
      user: data.user,
    });
    await supabase.auth.signOut();
    return errorState(
      `We could not prepare your profile — ${describeProfileProvisioningError(error)}`,
    );
  }

  redirect(nextPath);
}

export async function register(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const validation = validateRegistrationFormData(formData);

  if (validation.error || !validation.data) {
    return errorState(validation.error ?? "Invalid registration details.");
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "auth.register",
    identifiers: [validation.data.email],
    limit: 5,
    windowSeconds: 15 * 60,
  });

  if (!rateLimit.allowed) {
    return errorState(RATE_LIMITED_MESSAGE);
  }

  const nextPath = sanitizeRedirectPath(formData.get("next"));
  const origin = await getTrustedRequestOrigin();
  const callbackUrl = new URL("/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: validation.data.email,
    password: validation.data.password,
    options: {
      data: {
        full_name: validation.data.fullName ?? null,
      },
      emailRedirectTo: callbackUrl.toString(),
    },
  });

  if (error || !data.user) {
    return errorState("We could not create that account.");
  }

  try {
    await ensureUserProfile(data.user);
  } catch (error) {
    logProfileProvisioningError({
      context: "register",
      error,
      user: data.user,
    });
    return errorState(
      `Your account was created, but profile setup failed — ${describeProfileProvisioningError(error)}`,
    );
  }

  if (data.session) {
    redirect(nextPath);
  }

  return {
    status: "success",
    message: "Account created. Check your email to confirm your sign in.",
  };
}

export async function signInWithGoogle(formData: FormData) {
  const nextPath = sanitizeRedirectPath(formData.get("next"));
  const rateLimit = await checkRequestRateLimit({
    bucket: "auth.oauth",
    limit: 10,
    windowSeconds: 60,
  });

  if (!rateLimit.allowed) {
    const message = encodeURIComponent(RATE_LIMITED_MESSAGE);
    redirect(`/login?message=${message}&next=${encodeURIComponent(nextPath)}`);
  }

  const origin = await getTrustedRequestOrigin();
  const callbackUrl = new URL("/callback", origin);
  callbackUrl.searchParams.set("next", nextPath);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data?.url) {
    const message = encodeURIComponent("Could not start Google sign-in.");
    redirect(`/login?message=${message}&next=${encodeURIComponent(nextPath)}`);
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
