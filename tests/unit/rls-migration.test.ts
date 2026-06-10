import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const hardeningMigrationName = "0008_enable_rls_deny_by_default.sql";

function readMigration(name: string) {
  return fs.readFileSync(path.join(migrationsDir, name), "utf8");
}

function currentPublicTables() {
  const sourceSql = fs
    .readdirSync(migrationsDir)
    .filter(
      (name) =>
        /^\d+_.*\.sql$/.test(name) &&
        name < hardeningMigrationName &&
        name !== hardeningMigrationName,
    )
    .map(readMigration)
    .join("\n");

  return Array.from(
    new Set(
      Array.from(sourceSql.matchAll(/create table public\.([a-z_]+)/gi)).map(
        (match) => match[1],
      ),
    ),
  ).sort();
}

describe("RLS hardening migration", () => {
  it("enables deny-by-default RLS for every current public table", () => {
    const migration = readMigration(hardeningMigrationName);
    const tables = currentPublicTables();

    expect(tables.length).toBeGreaterThan(0);

    tables.forEach((table) => {
      expect(migration).toContain(
        `alter table public.${table} enable row level security;`,
      );
      expect(migration).toContain(
        `alter table public.${table} force row level security;`,
      );
    });

    expect(migration).not.toMatch(/create\s+policy/i);
    expect(migration).toMatch(
      /revoke all on all tables in schema public from anon, authenticated;/i,
    );
  });

  it("keeps private file storage private without adding public object policies", () => {
    const migration = readMigration(hardeningMigrationName);

    expect(migration).toContain(
      "values ('bextudio-files', 'bextudio-files', false)",
    );
    expect(migration).toContain("set public = false;");
    expect(migration).not.toMatch(/alter table storage\.objects/i);
    expect(migration).toContain("supabase_storage_admin");
  });
});
