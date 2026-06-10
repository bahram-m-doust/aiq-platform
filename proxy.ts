import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Must cover every protected top-level app segment (see APP_ROOT_SEGMENTS in
// lib/routes.ts) plus the admin area and auth pages. Next.js requires matcher
// patterns to be statically analyzable string literals, so they are listed
// explicitly here rather than derived from the route constants.
export const config = {
  matcher: [
    "/home",
    "/brand-integrated-brain/:path*",
    "/agents/:path*",
    "/documents/:path*",
    "/settings/:path*",
    "/modules/:path*",
    "/change-requests/:path*",
    "/create-brand/:path*",
    "/invitations/:path*",
    "/admin/:path*",
    "/login",
    "/register",
  ],
};
