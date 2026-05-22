import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("Netlify readiness", () => {
  it("keeps Netlify build settings compatible with server-rendered Next.js", () => {
    const netlifyConfig = readRepoFile("netlify.toml");
    const nextConfig = readRepoFile("next.config.ts");

    expect(netlifyConfig).toContain('command = "npm run build"');
    expect(netlifyConfig).toContain('publish = ".next"');
    expect(nextConfig).not.toMatch(/output\s*:\s*["']export["']/);
  });

  it("ignores local Netlify output without hiding committed config", () => {
    const gitignore = readRepoFile(".gitignore");

    expect(gitignore).toContain(".netlify/");
    expect(gitignore).not.toContain("netlify.toml");
  });

  it("documents Netlify env and Supabase auth callback requirements", () => {
    const doc = readRepoFile("docs", "NETLIFY_READINESS.md");

    expect(doc).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(doc).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(doc).toContain("APP_BASE_URL");
    expect(doc).toContain("ADMIN_BASE_URL");
    expect(doc).toContain("https://<netlify-domain>/callback**");
    expect(doc).toContain(
      "https://<project-ref>.supabase.co/auth/v1/callback",
    );
    expect(doc).toContain("/api/health");
  });
});
