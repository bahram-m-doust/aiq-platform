import { describe, expect, it } from "vitest";

import { config } from "@/proxy";
import { APP_ROOT_SEGMENTS } from "@/lib/routes";

// The proxy matcher must be statically-analyzable string literals (Next.js
// requirement), so it can't be derived from APP_ROOT_SEGMENTS at runtime. This
// test is the guard that keeps the two in lockstep: every protected app segment
// must have a matcher entry, otherwise middleware never runs for that route and
// it becomes silently unauthenticated.
describe("proxy matcher", () => {
  const matchers = config.matcher;

  it("protects every app root segment", () => {
    for (const segment of APP_ROOT_SEGMENTS) {
      const covered = matchers.some(
        (m) => m === `/${segment}` || m === `/${segment}/:path*`,
      );
      expect(covered, `proxy matcher is missing /${segment}`).toBe(true);
    }
  });

  it("keeps the admin area and auth pages protected", () => {
    for (const required of ["/admin/:path*", "/login", "/register"]) {
      expect(matchers).toContain(required);
    }
  });
});
