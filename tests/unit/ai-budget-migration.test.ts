import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "0028_ai_budget_reservations.sql",
  ),
  "utf8",
);

describe("AI budget reservations migration", () => {
  it("serializes reservations per brand and counts active reservations", () => {
    expect(migration).toMatch(/from public\.brands[\s\S]+for update;/i);
    expect(migration).toMatch(
      /from public\.ai_usage_reservations[\s\S]+status = 'RESERVED'[\s\S]+expires_at > now\(\)/i,
    );
    expect(migration).toContain("AI_BUDGET_EXCEEDED");
  });

  it("settles usage and attaches ledger rows through service-role-only RPCs", () => {
    expect(migration).toMatch(/create or replace function public\.settle_ai_usage/i);
    expect(migration).toMatch(/create or replace function public\.attach_ai_usage_to_run/i);
    expect(migration).toMatch(
      /revoke all on function public\.reserve_ai_budget[\s\S]+from public, anon, authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.settle_ai_usage[\s\S]+to service_role;/i,
    );
  });
});
