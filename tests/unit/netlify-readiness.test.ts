import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
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
    expect(doc).toContain("DATABASE_URL");
    expect(doc).toContain("SECRETS_SCAN_OMIT_KEYS");
    expect(doc).toContain("SECRETS_SCAN_ENABLED=false");
    expect(doc).toContain("/api/health");
  });

  it("does not directly dot-access server-only env keys in bundled app code", () => {
    const bundledDirs = ["app", "features", "lib"];
    const secretEnvPattern =
      /process\.env\.(SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|RESEND_API_KEY)/;
    const matches = bundledDirs.flatMap((dir) =>
      listFiles(path.join(process.cwd(), dir))
        .filter(
          (filePath) =>
            filePath !==
            path.join(process.cwd(), "lib", "env", "runtime.ts"),
        )
        .filter((filePath) =>
          secretEnvPattern.test(fs.readFileSync(filePath, "utf8")),
        )
        .map((filePath) => path.relative(process.cwd(), filePath)),
    );

    expect(matches).toEqual([]);
  });
});
