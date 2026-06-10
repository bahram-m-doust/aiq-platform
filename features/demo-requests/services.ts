import "server-only";

import {
  getDemoRequestById,
  toDemoRequestRecord,
  type DemoRequestRow,
} from "@/features/demo-requests/queries";
import { toDemoRequestAuditMetadata } from "@/features/demo-requests/schema";
import type { DemoRequestRecord } from "@/features/demo-requests/types";
import type { UserProfile } from "@/features/auth/types";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "demo_request";

type DemoRequestRpcRow = {
  request_id: string;
  request_user_id: string | null;
  request_email: string;
  request_message: string | null;
  request_status: string;
  request_reviewed_by: string | null;
  request_reviewed_at: string | null;
  request_resolution_note: string | null;
  request_approved_access_key_id: string | null;
  request_created_at: string | null;
  request_updated_at: string | null;
  created?: boolean;
};

function demoRequestError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isDemoRequestError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function toDemoRequestRow(row: DemoRequestRpcRow): DemoRequestRow {
  return {
    id: row.request_id,
    user_id: row.request_user_id,
    email: row.request_email,
    message: row.request_message,
    status: row.request_status,
    reviewed_by: row.request_reviewed_by,
    reviewed_at: row.request_reviewed_at,
    resolution_note: row.request_resolution_note,
    approved_access_key_id: row.request_approved_access_key_id,
    created_at: row.request_created_at,
    updated_at: row.request_updated_at,
  };
}

function firstRpcRow(data: unknown): DemoRequestRpcRow | null {
  return (Array.isArray(data) ? data[0] : data) as DemoRequestRpcRow | null;
}

function mapResolutionError(error: { message?: string }) {
  if (
    error.message?.includes("could not be found") ||
    error.message?.includes("already been resolved")
  ) {
    demoRequestError(error.message);
  }
}

export async function createDemoRequest({
  profile,
  message,
}: {
  profile: UserProfile;
  message: string | null;
}): Promise<DemoRequestRecord> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_demo_request_atomic", {
    p_user_id: profile.id,
    p_email: profile.email,
    p_message: message,
  });
  if (error) throw error;

  const row = firstRpcRow(data);
  if (!row) throw new Error("Demo request transaction returned no result.");
  if (!row.created) {
    demoRequestError(
      "You already have a pending demo request. Our team will reach out shortly.",
    );
  }

  const record = toDemoRequestRecord(toDemoRequestRow(row));

  await logAudit({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    action: "demo_request_created",
    entityType: "demo_request",
    entityId: record.id,
    after: toDemoRequestAuditMetadata(record),
  });

  return record;
}

export async function markDemoRequestApproved({
  demoRequestId,
  reviewer,
  accessKeyId,
}: {
  demoRequestId: string;
  reviewer: UserProfile;
  accessKeyId: string;
}): Promise<DemoRequestRecord> {
  const before = await getDemoRequestById(demoRequestId);

  if (!before) {
    demoRequestError("Demo request could not be found.");
  }

  if (before.status !== "REQUESTED") {
    demoRequestError("This demo request has already been resolved.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_demo_request_atomic", {
    p_request_id: demoRequestId,
    p_decision: "APPROVED",
    p_reviewer_id: reviewer.id,
    p_access_key_id: accessKeyId,
    p_resolution_note: null,
  });
  if (error) {
    mapResolutionError(error);
    throw error;
  }

  const row = firstRpcRow(data);
  if (!row) throw new Error("Demo request transaction returned no result.");
  const after = toDemoRequestRecord(toDemoRequestRow(row));

  await logAudit({
    actorUserId: reviewer.id,
    actorRole: reviewer.global_role,
    action: "demo_request_approved",
    entityType: "demo_request",
    entityId: after.id,
    before: toDemoRequestAuditMetadata(before),
    after: toDemoRequestAuditMetadata(after),
  });

  return after;
}

export async function rejectDemoRequest({
  demoRequestId,
  reviewer,
  resolutionNote,
}: {
  demoRequestId: string;
  reviewer: UserProfile;
  resolutionNote: string | null;
}): Promise<DemoRequestRecord> {
  const before = await getDemoRequestById(demoRequestId);

  if (!before) {
    demoRequestError("Demo request could not be found.");
  }

  if (before.status !== "REQUESTED") {
    demoRequestError("This demo request has already been resolved.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("resolve_demo_request_atomic", {
    p_request_id: demoRequestId,
    p_decision: "REJECTED",
    p_reviewer_id: reviewer.id,
    p_access_key_id: null,
    p_resolution_note: resolutionNote,
  });
  if (error) {
    mapResolutionError(error);
    throw error;
  }

  const row = firstRpcRow(data);
  if (!row) throw new Error("Demo request transaction returned no result.");
  const after = toDemoRequestRecord(toDemoRequestRow(row));

  await logAudit({
    actorUserId: reviewer.id,
    actorRole: reviewer.global_role,
    action: "demo_request_rejected",
    entityType: "demo_request",
    entityId: after.id,
    before: toDemoRequestAuditMetadata(before),
    after: toDemoRequestAuditMetadata(after),
  });

  return after;
}
