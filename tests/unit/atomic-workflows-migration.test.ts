import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readMigration(name: string) {
  return fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", name),
    "utf8",
  );
}

describe("atomic workflow migrations", () => {
  it("attaches review deliverables and module artifacts transactionally", () => {
    const migration = readMigration("0029_atomic_file_workflows.sql");

    expect(migration).toMatch(
      /create or replace function public\.attach_review_deliverable/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.create_module_artifact_with_file/i,
    );
    expect(migration).toContain("for update;");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toMatch(
      /grant execute on function public\.attach_review_deliverable[\s\S]+to service_role;/i,
    );
  });

  it("transitions module review state inside one service-role RPC", () => {
    const migration = readMigration("0030_atomic_module_review.sql");

    expect(migration).toMatch(
      /create or replace function public\.transition_module_review/i,
    );
    expect(migration).toContain("for update of ma, f;");
    expect(migration).toContain("'CLIENT_REQUEST_CHANGE'");
    expect(migration).toMatch(
      /revoke all on function public\.transition_module_review[\s\S]+from public, anon, authenticated;/i,
    );
  });

  it("promotes files and knowledge rows in one transaction", () => {
    const migration = readMigration("0031_atomic_rag_promotion.sql");

    expect(migration).toMatch(
      /create or replace function public\.promote_document_to_rag/i,
    );
    expect(migration).toMatch(
      /update public\.files[\s\S]+insert into public\.knowledge_files/i,
    );
    expect(migration).toContain("#variable_conflict use_column");
    expect(migration).toContain("on conflict (brand_id, file_id) do update");
    expect(migration).toMatch(
      /grant execute on function public\.promote_document_to_rag\(uuid, uuid\)[\s\S]+to service_role;/i,
    );
  });

  it("queues storage deletion in the same transaction as file deletion", () => {
    const migration = readMigration("0032_storage_cleanup_outbox.sql");

    expect(migration).toMatch(
      /create table if not exists public\.storage_cleanup_jobs/i,
    );
    expect(migration).toContain(
      "alter table public.storage_cleanup_jobs force row level security;",
    );
    expect(migration).toMatch(
      /create or replace function public\.delete_file_and_queue_storage_cleanup/i,
    );
    expect(migration).toMatch(
      /enqueue_storage_cleanup[\s\S]+delete from public\.files/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.delete_file_and_queue_storage_cleanup\(uuid, text\)[\s\S]+to service_role;/i,
    );
  });

  it("grants plan and agent entitlements through a race-safe transaction", () => {
    const migration = readMigration("0033_atomic_brand_access_grants.sql");

    expect(migration).toMatch(
      /create or replace function public\.grant_brand_access_atomic/i,
    );
    expect(migration).toMatch(
      /on conflict \(idempotency_key\)[\s\S]+do nothing/i,
    );
    expect(migration).toMatch(
      /insert into public\.agent_entitlements[\s\S]+on conflict \(brand_id, agent_id\) do update/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.grant_brand_access_atomic[\s\S]+from public, anon, authenticated;/i,
    );
  });

  it("transitions all RAG approval records in one locked transaction", () => {
    const migration = readMigration("0034_atomic_rag_approval.sql");

    expect(migration).toMatch(
      /create or replace function public\.transition_rag_approval/i,
    );
    expect(migration).toContain("for update of bm, ma, f;");
    expect(migration).toMatch(
      /update public\.knowledge_files[\s\S]+update public\.brand_modules[\s\S]+update public\.module_artifacts[\s\S]+update public\.files/i,
    );
    expect(migration).toContain("'RAG_SYNCED'");
    expect(migration).toMatch(
      /revoke all on function public\.transition_rag_approval[\s\S]+from public, anon, authenticated;/i,
    );
  });

  it("hardens demo and AI instruction workflows against concurrent writes", () => {
    const migration = readMigration("0035_release_race_hardening.sql");

    expect(migration).toMatch(
      /create unique index if not exists ux_demo_requests_pending_user/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.create_demo_request_atomic/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.resolve_demo_request_atomic/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.activate_demo_access_atomic/i,
    );
    expect(migration).toMatch(
      /from public\.grant_brand_access_atomic/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.upsert_brand_agent_instruction_atomic/i,
    );
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("creates a complete brand workspace in one transaction", () => {
    const migration = readMigration("0036_atomic_brand_creation.sql");

    expect(migration).toMatch(
      /create or replace function public\.create_brand_from_access_key_atomic/i,
    );
    expect(migration).toMatch(
      /from public\.access_keys[\s\S]+for update/i,
    );
    expect(migration).toMatch(
      /insert into public\.brands[\s\S]+update public\.access_keys[\s\S]+insert into public\.brand_memberships[\s\S]+insert into public\.intake_sessions[\s\S]+insert into public\.brand_modules/i,
    );
    expect(migration).toMatch(
      /from public\.grant_brand_access_atomic/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_brand_from_access_key_atomic[\s\S]+to service_role/i,
    );
  });

  it("swaps intake ordering through locked transactions", () => {
    const migration = readMigration("0037_atomic_intake_reordering.sql");

    expect(migration).toMatch(
      /create or replace function public\.reorder_intake_section_atomic/i,
    );
    expect(migration).toMatch(
      /create or replace function public\.reorder_intake_question_atomic/i,
    );
    expect(migration.match(/for update;/gi)).toHaveLength(2);
    expect(migration).toMatch(
      /update public\.question_sections[\s\S]+where id in \(p_section_id, v_target_id\)/i,
    );
    expect(migration).toMatch(
      /update public\.questions[\s\S]+where id in \(p_question_id, v_target_id\)/i,
    );
  });

  it("activates redeemed brand memberships under key and entitlement locks", () => {
    const migration = readMigration(
      "0038_atomic_redeemed_brand_membership.sql",
    );

    expect(migration).toMatch(
      /create or replace function public\.activate_redeemed_brand_membership_atomic/i,
    );
    expect(migration).toMatch(
      /from public\.access_keys[\s\S]+for update/i,
    );
    expect(migration).toMatch(
      /from public\.brand_entitlements[\s\S]+for update/i,
    );
    expect(migration).toMatch(
      /on conflict \(brand_id, user_id, role\) do update/i,
    );
    expect(migration).toContain("expires_at = null");
    expect(migration).toMatch(
      /revoke all on function public\.activate_redeemed_brand_membership_atomic[\s\S]+from public, anon, authenticated/i,
    );
  });

  it("repairs final RAG consistency without downgrading sync state", () => {
    const migration = readMigration("0039_rag_approval_consistency.sql");

    expect(migration).toMatch(
      /v_knowledge\.rag_status in \([\s\S]+'RAG_SYNCED'[\s\S]+'SYNC_FAILED'/i,
    );
    expect(migration).toMatch(
      /approved_by_platform_owner is not null[\s\S]+update public\.brand_modules[\s\S]+update public\.module_artifacts[\s\S]+update public\.files/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.transition_rag_approval[\s\S]+to service_role/i,
    );
  });
});
