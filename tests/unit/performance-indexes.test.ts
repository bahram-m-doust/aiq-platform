import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "0009_performance_indexes.sql",
  ),
  "utf8",
);

const expectedIndexes = [
  "idx_brand_memberships_user_status_brand",
  "idx_brand_entitlements_brand_status_window",
  "idx_intake_sessions_brand_status_created",
  "idx_brand_modules_brand_status_updated",
  "idx_brand_modules_assigned_updated",
  "idx_module_artifacts_module_version_created",
  "idx_module_reviews_module_created",
  "idx_files_brand_status_created",
  "idx_change_requests_brand_status_created",
  "idx_agent_runs_brand_agent_created",
  "idx_audit_logs_brand_created",
] as const;

describe("performance indexes migration", () => {
  it("adds every planned low-risk composite index", () => {
    expectedIndexes.forEach((indexName) => {
      expect(migration).toMatch(
        new RegExp(`create index if not exists ${indexName}\\b`, "i"),
      );
    });
  });

  it("keeps the migration limited to additive index creation", () => {
    expect(migration).not.toMatch(/\b(alter|drop|delete|update|insert)\b/i);
  });
});
