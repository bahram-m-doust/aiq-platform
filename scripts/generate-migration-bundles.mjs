import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptsDir, "..");
const migrationsDir = path.join(rootDir, "supabase", "migrations");

const migrationNames = fs
  .readdirSync(migrationsDir)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort((left, right) => left.localeCompare(right));

if (migrationNames.length === 0) {
  throw new Error("No numbered Supabase migrations were found.");
}

const latestMigration = migrationNames.at(-1);
const generatedHeader = `-- GENERATED FILE. DO NOT EDIT DIRECTLY.
-- Source: numbered SQL files in supabase/migrations.
-- Latest migration: ${latestMigration}
-- Regenerate with: npm run db:generate-bundles
`;

const migrationBody = migrationNames
  .map((name) => {
    const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8").trim();
    return `-- BEGIN ${name}\n${sql}\n-- END ${name}`;
  })
  .join("\n\n");

const grantsFooter = `
-- Keep server-side Supabase access explicit after fresh schema creation.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

notify pgrst, 'reload schema';
`;

const destructivePreamble = `
-- DESTRUCTIVE: this variant removes all public application data.
do $$
begin
  drop policy if exists brand_icons_public_read on storage.objects;
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects policy cleanup (not owner).';
end $$;

drop schema if exists public cascade;
create schema public;

grant usage on schema public to anon, authenticated, service_role, postgres;
grant create on schema public to postgres, service_role;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on routines to service_role;
`;

const outputs = new Map([
  [
    path.join(migrationsDir, "setup-all.sql"),
    `${generatedHeader}\n${migrationBody}\n${grantsFooter}`,
  ],
  [
    path.join(migrationsDir, "bootstrap-fresh.sql"),
    `${generatedHeader}${destructivePreamble}\n${migrationBody}\n${grantsFooter}`,
  ],
]);

if (process.argv.includes("--check")) {
  const staleFiles = [...outputs].filter(
    ([filePath, expected]) =>
      !fs.existsSync(filePath) || fs.readFileSync(filePath, "utf8") !== expected,
  );
  if (staleFiles.length > 0) {
    console.error(
      `Stale migration bundles: ${staleFiles
        .map(([filePath]) => path.basename(filePath))
        .join(", ")}`,
    );
    process.exit(1);
  }
} else {
  for (const [filePath, contents] of outputs) {
    fs.writeFileSync(filePath, contents);
  }
}

console.log(
  `Migration bundles are current through ${latestMigration}.`,
);
