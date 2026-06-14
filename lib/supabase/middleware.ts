import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { ROUTES, APP_ROOT_SEGMENTS } from "@/lib/routes";
import { resolveAuthUser } from "@/lib/supabase/auth-user";
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

  // NOTE: getClaims() verifies the JWT locally and can THROW (not just return
  // an error) while decoding the token or running the WebCrypto signature check
  // — e.g. with asymmetric (ES256) signing keys or a stale cookie. resolveAuthUser
  // guards that and falls back to a server-side getUser() check so a bad token
  // redirects to login instead of crashing every protected route with a 500.
  const authUser = await resolveAuthUser(supabase);
  const hasUser = Boolean(authUser);

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
