import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { AuditLogList } from "@/features/audit/components/AuditLogList";
import { getLatestAuditLogs } from "@/features/audit/queries";
import type { AuditLogRecord } from "@/features/audit/types";
import {
  isSensitiveAuditKey,
  logAudit,
  sanitizeAuditJson,
} from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function setupInsertClient() {
  const insert = vi.fn((value: unknown) =>
    Promise.resolve({ data: value, error: null }),
  );
  const from = vi.fn((table: string) => {
    if (table !== "audit_logs") {
      throw new Error(`Unexpected table ${table}`);
    }

    return { insert };
  });

  mockedCreateAdminClient.mockReturnValue({ from } as never);

  return { from, insert };
}

function setupQueryClient() {
  const queryBuilder = {
    select: vi.fn(() => queryBuilder),
    order: vi.fn(() => queryBuilder),
    range: vi.fn(() =>
      Promise.resolve({
        data: [
          {
            id: "audit-1",
            actor_user_id: "profile-1",
            actor_role: "PLATFORM_OWNER",
            brand_id: "brand-1",
            action: "plan_granted",
            entity_type: "brand_entitlement",
            entity_id: "entitlement-1",
            before_json: null,
            after_json: { status: "ACTIVE" },
            ip_address: null,
            user_agent: null,
            created_at: "2026-05-18T08:00:00.000Z",
          },
        ],
        error: null,
      }),
    ),
  };
  const from = vi.fn((table: string) => {
    if (table !== "audit_logs") {
      throw new Error(`Unexpected table ${table}`);
    }

    return queryBuilder;
  });

  mockedCreateAdminClient.mockReturnValue({ from } as never);

  return { queryBuilder };
}

function auditLog(overrides: Partial<AuditLogRecord> = {}): AuditLogRecord {
  return {
    id: "audit-1",
    actorUserId: "profile-1",
    actorRole: "PLATFORM_OWNER",
    brandId: "brand-1",
    action: "agent_activated",
    entityType: "agent_entitlement",
    entityId: "entitlement-1",
    before: { old_status: "LOCKED_BY_BRAIN" },
    after: { new_status: "ACTIVE" },
    ipAddress: null,
    userAgent: null,
    createdAt: "2026-05-18T08:00:00.000Z",
    ...overrides,
  };
}

describe("central audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the expected audit row shape", async () => {
    const { insert } = setupInsertClient();

    await logAudit({
      actorUserId: "profile-1",
      actorRole: "PLATFORM_OWNER",
      brandId: "brand-1",
      action: "plan_granted",
      entityType: "brand_entitlement",
      entityId: "entitlement-1",
      before: null,
      after: { status: "ACTIVE", plan_id: "plan-1" },
      ipAddress: "127.0.0.1",
      userAgent: "Vitest",
    });

    expect(insert).toHaveBeenCalledWith({
      actor_user_id: "profile-1",
      actor_role: "PLATFORM_OWNER",
      brand_id: "brand-1",
      action: "plan_granted",
      entity_type: "brand_entitlement",
      entity_id: "entitlement-1",
      before_json: null,
      after_json: { status: "ACTIVE", plan_id: "plan-1" },
      ip_address: "127.0.0.1",
      user_agent: "Vitest",
    });
  });

  it("allows null actor, brand, and entity fields", async () => {
    const { insert } = setupInsertClient();

    await logAudit({
      action: "access_key_failed",
      after: { outcome: "failed" },
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: null,
        actor_role: null,
        brand_id: null,
        entity_type: null,
        entity_id: null,
      }),
    );
  });

  it("redacts forbidden metadata keys before insert", async () => {
    const { insert } = setupInsertClient();

    await logAudit({
      actorUserId: "profile-1",
      action: "access_key_created",
      after: {
        rawKey: "bext_raw_secret",
        key_hash: "stored-hash",
        signedUrl: "https://signed.example",
        fileContent: "private document body",
        prompt: "private prompt",
        answer: "private answer",
        access_key: {
          id: "access-key-1",
          key_prefix: "bext_123",
        },
      },
    });

    const row = insert.mock.calls[0]?.[0] as { after_json: unknown };
    const rowJson = JSON.stringify(row.after_json);

    expect(row.after_json).toMatchObject({
      rawKey: "[REDACTED]",
      key_hash: "[REDACTED]",
      signedUrl: "[REDACTED]",
      fileContent: "[REDACTED]",
      prompt: "[REDACTED]",
      answer: "[REDACTED]",
      access_key: {
        id: "access-key-1",
        key_prefix: "bext_123",
      },
    });
    expect(rowJson).not.toContain("bext_raw_secret");
    expect(rowJson).not.toContain("stored-hash");
    expect(rowJson).not.toContain("signed.example");
    expect(rowJson).not.toContain("private document body");
    expect(rowJson).not.toContain("private prompt");
    expect(rowJson).not.toContain("private answer");
  });

  it("identifies sensitive audit keys and sanitizes standalone JSON", () => {
    expect(isSensitiveAuditKey("key_hash")).toBe(true);
    expect(isSensitiveAuditKey("key_prefix")).toBe(false);
    expect(isSensitiveAuditKey("provider_vector_store_id")).toBe(false);
    expect(
      sanitizeAuditJson({
        key_prefix: "bext_123",
        prompt: "do not store",
      }),
    ).toEqual({
      key_prefix: "bext_123",
      prompt: "[REDACTED]",
    });
  });

  it("reports persistence failures without failing the completed mutation", async () => {
    const insert = vi.fn(() =>
      Promise.resolve({
        data: null,
        error: { code: "08006", message: "database unavailable" },
      }),
    );
    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({ insert })),
    } as never);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const persisted = await logAudit({
      actorUserId: "profile-1",
      action: "brand_created",
      entityType: "brand",
      entityId: "brand-1",
    });

    expect(persisted).toBe(false);
    expect(consoleError).toHaveBeenCalledWith(
      "[audit] persistence failed",
      expect.objectContaining({
        action: "brand_created",
        entityId: "brand-1",
      }),
    );
    consoleError.mockRestore();
  });
});

describe("audit log queries and UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the latest audit logs with a conservative limit", async () => {
    const { queryBuilder } = setupQueryClient();

    const logs = await getLatestAuditLogs(500);

    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(queryBuilder.range).toHaveBeenCalledWith(0, 100);
    expect(logs.logs).toEqual([
      {
        id: "audit-1",
        actorUserId: "profile-1",
        actorRole: "PLATFORM_OWNER",
        brandId: "brand-1",
        action: "plan_granted",
        entityType: "brand_entitlement",
        entityId: "entitlement-1",
        before: null,
        after: { status: "ACTIVE" },
        ipAddress: null,
        userAgent: null,
        createdAt: "2026-05-18T08:00:00.000Z",
      },
    ]);
    expect(logs.pagination).toMatchObject({
      page: 1,
      pageSize: 100,
      hasPreviousPage: false,
      hasNextPage: false,
    });
  });

  it("renders audit logs as read-only operational records", () => {
    render(<AuditLogList logs={[auditLog()]} />);

    expect(screen.getByText("agent_activated")).toBeVisible();
    expect(screen.getByText("profile-1")).toBeVisible();
    expect(screen.getByText("brand-1")).toBeVisible();
    expect(screen.getByText(/agent_entitlement/)).toBeVisible();
    expect(screen.getByText(/LOCKED_BY_BRAIN/)).toBeVisible();
    expect(screen.getByText(/ACTIVE/)).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders an empty read-only state", () => {
    render(<AuditLogList logs={[]} />);

    expect(screen.getByText("Audit logs")).toBeVisible();
    expect(screen.getByText("No audit events have been recorded.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
