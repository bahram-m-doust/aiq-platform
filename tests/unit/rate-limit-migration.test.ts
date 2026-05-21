import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase", "migrations", "0010_rate_limits.sql"),
  "utf8",
);

describe("rate limit migration", () => {
  it("creates a private rate limit table with deny-by-default RLS", () => {
    expect(migration).toMatch(/create table if not exists public\.rate_limits/i);
    expect(migration).toMatch(
      /alter table public\.rate_limits enable row level security;/i,
    );
    expect(migration).toMatch(
      /alter table public\.rate_limits force row level security;/i,
    );
    expect(migration).toMatch(
      /revoke all on table public\.rate_limits from anon, authenticated;/i,
    );
  });

  it("adds atomic increment RPC access for service role only", () => {
    expect(migration).toMatch(
      /create or replace function public\.increment_rate_limit/i,
    );
    expect(migration).toMatch(/on conflict \(bucket, identifier_hash, window_start\)/i);
    expect(migration).toMatch(/public\.rate_limits\.count \+ 1/i);
    expect(migration).toMatch(
      /revoke all on function public\.increment_rate_limit\(text, text, timestamptz\)\s+from public, anon, authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.increment_rate_limit\(text, text, timestamptz\)\s+to service_role;/i,
    );
  });

  it("indexes bucket lookups and cleanup windows", () => {
    expect(migration).toMatch(
      /create index if not exists idx_rate_limits_bucket_identifier_window/i,
    );
    expect(migration).toMatch(
      /create index if not exists idx_rate_limits_window_start/i,
    );
  });
});
