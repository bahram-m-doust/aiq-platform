import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ROUTES, APP_ROOT_SEGMENTS } from "@/lib/routes";
import {
  getPublicSupabaseEnv,
  hasPublicSupabaseEnv,
} from "@/lib/supabase/env";

const adminPathPrefix = "/admin";
const adminLoginPath = "/admin/login";
const userLoginPath = "/login";
const userAuthPathPrefixes = ["/login", "/register"];

function isPrefixedPath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isAdminArea(pathname: string) {
  return isPrefixedPath(pathname, adminPathPrefix);
}

function isAdminLogin(pathname: string) {
  return pathname === adminLoginPath;
}

// App pages live under the `(app)` route group, so they have no shared
// URL prefix — their first path segment is the discriminator.
function isAppPath(pathname: string) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return firstSegment !== undefined && APP_ROOT_SEGMENTS.has(firstSegment);
}

function isProtectedPath(pathname: string) {
  if (isAppPath(pathname)) {
    return true;
  }
  return isAdminArea(pathname) && !isAdminLogin(pathname);
}

function isAuthPath(pathname: string) {
  if (isAdminLogin(pathname)) {
    return true;
  }
  return userAuthPathPrefixes.some((prefix) => isPrefixedPath(pathname, prefix));
}

function redirectToLogin(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  const target = isAdminArea(request.nextUrl.pathname)
    ? adminLoginPath
    : userLoginPath;
  redirectUrl.pathname = target;
  redirectUrl.search = "";
  redirectUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(redirectUrl);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedPath = isProtectedPath(pathname);

  if (!hasPublicSupabaseEnv()) {
    return protectedPath ? redirectToLogin(request) : NextResponse.next();
  }

  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const hasUser = !claimsError && Boolean(claimsData?.claims?.sub);

  if (protectedPath && !hasUser) {
    return redirectToLogin(request);
  }

  if (hasUser && isAuthPath(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = isAdminLogin(pathname) ? "/admin" : ROUTES.home;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
