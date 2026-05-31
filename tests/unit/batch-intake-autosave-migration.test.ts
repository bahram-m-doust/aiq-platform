import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "0020_batch_intake_autosave.sql",
);

describe("batch intake autosave migration", () => {
  const migration = readFileSync(migrationPath, "utf8");

  it("creates a service-role-only batch autosave RPC", () => {
    expect(migration).toMatch(
      /create or replace function public\.autosave_intake_answers_batch/i,
    );
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/set search_path = public, pg_temp/i);
    expect(migration).toMatch(
      /revoke all on function public\.autosave_intake_answers_batch\(uuid, uuid, jsonb\)\s+from public, anon, authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.autosave_intake_answers_batch\(uuid, uuid, jsonb\)\s+to service_role;/i,
    );
  });

  it("upserts answers atomically and updates completion once per batch", () => {
    expect(migration).toMatch(/jsonb_array_elements\(p_answers\)/i);
    expect(migration).toMatch(/delete from pg_temp\.autosave_intake_batch_input older/i);
    expect(migration).toMatch(/on conflict \(session_id, question_id\)/i);
    expect(migration).toMatch(/completion_percent = v_completion_percent/i);
    expect(migration.match(/update public\.intake_sessions/gi)).toHaveLength(1);
  });

  it("requests PostgREST schema reload after creating the RPC", () => {
    expect(migration).toMatch(/notify pgrst, 'reload schema';/i);
  });
});
