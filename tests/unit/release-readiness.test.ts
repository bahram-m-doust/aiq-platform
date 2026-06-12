import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRepoFile(...parts: string[]) {
  return fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

function envExampleKeys() {
  return readRepoFile(".env.example")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("=")[0])
    .sort();
}

describe("release readiness docs", () => {
  it("documents the latest Supabase migration and seed order", () => {
    const setup = readRepoFile("supabase", "migrations", "SETUP.md");
    const runbook = readRepoFile("docs", "MVP_RELEASE_RUNBOOK.md");
    const latestMigration = fs
      .readdirSync(path.join(process.cwd(), "supabase", "migrations"))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort()
      .at(-1);

    expect(latestMigration).toBeTruthy();
    expect(setup).toContain(latestMigration);
    expect(runbook).toContain(latestMigration);
    expect(setup).toContain("supabase/seeds/plans.sql");
    expect(setup).toContain("supabase/seeds/agents.sql");
    expect(setup).toContain("supabase/seeds/questions_sections.sql");
    expect(setup).toContain("NOTIFY pgrst, 'reload schema';");
    expect(runbook).toContain("npm run test:smoke");
    expect(runbook).toContain("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH");
    expect(readRepoFile("docs", "MONITORING.md")).toContain("/api/health");
  });

  it("keeps .env.example limited to currently used runtime keys", () => {
    expect(envExampleKeys()).toEqual([
      "ADMIN_BASE_URL",
      "APP_BASE_URL",
      "EMAIL_FROM",
      "KEY_ENCRYPTION_ACTIVE_KEY_ID",
      "KEY_ENCRYPTION_KEY",
      "KEY_ENCRYPTION_KEYS",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
      "OPENROUTER_API_KEY",
      "OPENROUTER_MODEL",
      "RESEND_API_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ]);

    const envExample = readRepoFile(".env.example");
    expect(envExample).not.toMatch(/DATABASE_URL|STRIPE|SMTP_/);
  });

  it("keeps the consolidated setup script aligned with private MVP hardening", () => {
    const setupAll = readRepoFile("supabase", "migrations", "setup-all.sql");
    const migrationNames = fs
      .readdirSync(path.join(process.cwd(), "supabase", "migrations"))
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();

    migrationNames.forEach((name) => {
      expect(setupAll).toContain(`-- BEGIN ${name}`);
      expect(setupAll).toContain(`-- END ${name}`);
    });
    expect(setupAll).toContain(
      `-- Latest migration: ${migrationNames.at(-1)}`,
    );
    expect(setupAll).toContain(
      "alter table public.audit_logs force row level security;",
    );
    expect(setupAll).toContain(
      "revoke all on all tables in schema public from anon, authenticated;",
    );
    // storage.objects RLS is owned by supabase_storage_admin on Supabase
    // Cloud and is enabled by default — setup-all.sql intentionally does
    // not toggle it (would fail with ERROR 42501 in the SQL Editor).
    expect(setupAll).not.toContain(
      "alter table storage.objects force row level security;",
    );
  });

  it("adds private-app robots and low-risk security headers", () => {
    const robots = readRepoFile("app", "robots.ts");
    const nextConfig = readRepoFile("next.config.ts");
    const healthRoute = readRepoFile("app", "api", "health", "route.ts");

    expect(robots).toContain('disallow: "/"');
    expect(healthRoute).toContain("getHealthStatus");
    expect(nextConfig).toContain("X-Content-Type-Options");
    expect(nextConfig).toContain("X-Frame-Options");
    expect(nextConfig).toContain('value: "SAMEORIGIN"');
    expect(nextConfig).toContain("Referrer-Policy");
    expect(nextConfig).toContain("Permissions-Policy");
  });
});
