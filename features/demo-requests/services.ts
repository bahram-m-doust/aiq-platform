import "server-only";

import {
  getDemoRequestById,
  hasPendingDemoRequestForUser,
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

function demoRequestError(message: string): never {
  throw new DomainError(CODE, message);
}

export function isDemoRequestError(error: unknown): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

export async function createDemoRequest({
  profile,
  message,
}: {
  profile: UserProfile;
  message: string | null;
}): Promise<DemoRequestRecord> {
  if (await hasPendingDemoRequestForUser(profile.id)) {
    demoRequestError(
      "You already have a pending demo request. Our team will reach out shortly.",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("demo_requests")
    .insert({
      user_id: profile.id,
      email: profile.email,
      message,
      status: "REQUESTED",
    })
    .select(
      "id, user_id, email, message, status, reviewed_by, reviewed_at, resolution_note, approved_access_key_id, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const record = toDemoRequestRecord(data as unknown as DemoRequestRow);

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
  const { data, error } = await admin
    .from("demo_requests")
    .update({
      status: "APPROVED",
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
      approved_access_key_id: accessKeyId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demoRequestId)
    .select(
      "id, user_id, email, message, status, reviewed_by, reviewed_at, resolution_note, approved_access_key_id, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toDemoRequestRecord(data as unknown as DemoRequestRow);

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
  const { data, error } = await admin
    .from("demo_requests")
    .update({
      status: "REJECTED",
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
      resolution_note: resolutionNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", demoRequestId)
    .select(
      "id, user_id, email, message, status, reviewed_by, reviewed_at, resolution_note, approved_access_key_id, created_at, updated_at",
    )
    .single();

  if (error) {
    throw error;
  }

  const after = toDemoRequestRecord(data as unknown as DemoRequestRow);

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
