import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "0019_fast_intake_autosave.sql",
  ),
  "utf8",
);

describe("fast intake autosave migration", () => {
  it("creates a service-role-only security-definer RPC", () => {
    expect(migration).toMatch(
      /create or replace function public\.autosave_intake_answer_fast/i,
    );
    expect(migration).toMatch(/p_auth_user_id uuid/i);
    expect(migration).toMatch(/security definer/i);
    expect(migration).toMatch(/set search_path = public/i);
    expect(migration).toMatch(
      /revoke all on function public\.autosave_intake_answer_fast\(uuid, uuid, uuid, jsonb\)\s+from public, anon, authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.autosave_intake_answer_fast\(uuid, uuid, uuid, jsonb\)\s+to service_role;/i,
    );
    expect(migration).not.toMatch(/\bgrant execute\b[\s\S]*\bto\s+(anon|authenticated)\b/i);
  });

  it("keeps autosave work in one database round trip", () => {
    expect(migration).toMatch(/on conflict \(session_id, question_id\)/i);
    expect(migration).toMatch(/completion_percent = v_completion_percent/i);
    expect(migration).toMatch(/where auth_user_id = p_auth_user_id/i);
    expect(migration).toMatch(/actor_profile_id uuid/i);
    expect(migration).toMatch(/m\.role in \('OWNER', 'EXECUTIVE_MANAGER'\)/i);
    expect(migration).toMatch(/global_role = 'PLATFORM_OWNER'/i);
  });
});
