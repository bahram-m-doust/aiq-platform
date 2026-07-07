import { NextResponse, type NextRequest } from "next/server";

import {
  describeProfileProvisioningError,
  ensureUserProfile,
  logProfileProvisioningError,
} from "@/features/auth/profile";
import {
  resolveLoginPathForNext,
  sanitizeRedirectPath,
} from "@/features/auth/redirects";
import { ROUTES } from "@/lib/routes";
import { hasPublicSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(
  request: NextRequest,
  message: string,
  nextPath: string = ROUTES.home,
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = resolveLoginPathForNext(nextPath);
  redirectUrl.search = "";
  redirectUrl.searchParams.set("message", message);
  redirectUrl.searchParams.set("next", sanitizeRedirectPath(nextPath));
  return NextResponse.redirect(redirectUrl);
}

export async function GET(request: NextRequest) {
  if (!hasPublicSupabaseEnv()) {
    return loginRedirect(request, "Supabase is not configured.");
  }

  const requestUrl = request.nextUrl;
  const code = requestUrl.searchParams.get("code");
  const nextPath = sanitizeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return loginRedirect(
      request,
      "The sign-in link is missing a code.",
      nextPath,
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return loginRedirect(
      request,
      "The sign-in link could not be verified.",
      nextPath,
    );
  }

  try {
    await ensureUserProfile(data.user);
  } catch (profileError) {
    logProfileProvisioningError({
      context: "callback",
      error: profileError,
      user: data.user,
    });
    await supabase.auth.signOut();
    const detail = describeProfileProvisioningError(profileError);
    return loginRedirect(
      request,
      `Profile setup failed - ${detail}`,
      nextPath,
    );
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = nextPath;
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}
