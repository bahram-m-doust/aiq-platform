import "server-only";

import { isDemoRequestStatus } from "@/features/demo-requests/schema";
import type {
  DemoRequestRecord,
  DemoRequestStatus,
} from "@/features/demo-requests/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type DemoRequestRow = {
  id: string;
  user_id: string | null;
  email: string;
  message: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  approved_access_key_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export const demoRequestColumns = [
  "id",
  "user_id",
  "email",
  "message",
  "status",
  "reviewed_by",
  "reviewed_at",
  "resolution_note",
  "approved_access_key_id",
  "created_at",
  "updated_at",
].join(", ");

function safeStatus(value: string): DemoRequestStatus {
  return isDemoRequestStatus(value) ? value : "REQUESTED";
}

export function toDemoRequestRecord(row: DemoRequestRow): DemoRequestRecord {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    message: row.message,
    status: safeStatus(row.status),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    resolutionNote: row.resolution_note,
    approvedAccessKeyId: row.approved_access_key_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPendingDemoRequests(): Promise<DemoRequestRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("demo_requests")
    .select(demoRequestColumns)
    .eq("status", "REQUESTED")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as DemoRequestRow[]).map(toDemoRequestRecord);
}

export async function getDemoRequestById(
  id: string,
): Promise<DemoRequestRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("demo_requests")
    .select(demoRequestColumns)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? toDemoRequestRecord(data as unknown as DemoRequestRow) : null;
}

export async function getPendingDemoRequestCount(): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("demo_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "REQUESTED");

  if (error) throw error;
  return count ?? 0;
}

export async function hasPendingDemoRequestForUser(
  userId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("demo_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "REQUESTED");

  if (error) throw error;
  return (count ?? 0) > 0;
}
