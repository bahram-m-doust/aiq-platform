import "server-only";

import { randomUUID } from "node:crypto";

import { buildStoragePath } from "@/features/documents/schema";
import {
  removePrivateFile,
  uploadPrivateFile,
} from "@/features/documents/storage";
import { normalizePosition } from "@/features/stakeholder-interviews/schema";
import { getStakeholderReportRowByBrand } from "@/features/stakeholder-interviews/queries";
import type {
  StakeholderAnnotation,
} from "@/features/stakeholder-interviews/types";
import { createAdminClient } from "@/lib/supabase/admin";

async function ensureReport(brandId: string): Promise<string> {
  const existing = await getStakeholderReportRowByBrand(brandId);
  if (existing) return existing.id;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stakeholder_interview_reports")
    .insert({ brand_id: brandId, status: "PENDING_UPLOAD" })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function uploadStakeholderReport({
  brandId,
  profileId,
  file,
}: {
  brandId: string;
  profileId: string;
  file: File;
}): Promise<void> {
  const reportId = await ensureReport(brandId);

  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    brandId,
    fileId,
    originalName: file.name,
  });

  await uploadPrivateFile({
    storagePath,
    file,
    mimeType: file.type || null,
  });

  const admin = createAdminClient();
  const { error: fileError } = await admin.from("files").insert({
    id: fileId,
    brand_id: brandId,
    storage_path: storagePath,
    original_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    visibility: "CLIENT_REVIEW",
    status: "CLIENT_REVIEW",
    uploaded_by: profileId,
  });
  if (fileError) {
    await removePrivateFile(storagePath);
    throw fileError;
  }

  const now = new Date().toISOString();
  const { error: reportError } = await admin
    .from("stakeholder_interview_reports")
    .update({
      file_id: fileId,
      status: "CLIENT_REVIEW",
      uploaded_by: profileId,
      uploaded_at: now,
      approved_by: null,
      approved_at: null,
      updated_at: now,
    })
    .eq("id", reportId)
    .eq("brand_id", brandId);
  if (reportError) {
    await removePrivateFile(storagePath);
    throw reportError;
  }
}

export async function addStakeholderAnnotation({
  reportId,
  profileId,
  page,
  posX,
  posY,
  body,
}: {
  reportId: string;
  profileId: string;
  page: number;
  posX: number;
  posY: number;
  body: string;
}): Promise<StakeholderAnnotation> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("stakeholder_interview_annotations")
    .insert({
      report_id: reportId,
      author_id: profileId,
      page,
      pos_x: normalizePosition(posX),
      pos_y: normalizePosition(posY),
      body,
    })
    .select(
      "id, report_id, author_id, page, pos_x, pos_y, body, resolved, created_at",
    )
    .single();
  if (error) throw error;

  const row = data as {
    id: string;
    report_id: string;
    author_id: string | null;
    page: number;
    pos_x: number | string;
    pos_y: number | string;
    body: string;
    resolved: boolean;
    created_at: string | null;
  };
  return {
    id: row.id,
    reportId: row.report_id,
    authorId: row.author_id,
    authorName: null,
    authorEmail: null,
    page: row.page,
    posX: Number(row.pos_x),
    posY: Number(row.pos_y),
    body: row.body,
    resolved: row.resolved,
    createdAt: row.created_at,
  };
}

export async function setStakeholderAnnotationResolved({
  annotationId,
  reportId,
  resolved,
}: {
  annotationId: string;
  reportId: string;
  resolved: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("stakeholder_interview_annotations")
    .update({ resolved, updated_at: new Date().toISOString() })
    .eq("id", annotationId)
    .eq("report_id", reportId);
  if (error) throw error;
}

export async function setStakeholderReportStatus({
  brandId,
  profileId,
  status,
}: {
  brandId: string;
  profileId: string;
  status: "APPROVED" | "CHANGES_REQUESTED";
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const patch =
    status === "APPROVED"
      ? { status, approved_by: profileId, approved_at: now, updated_at: now }
      : { status, approved_by: null, approved_at: null, updated_at: now };

  const { error } = await admin
    .from("stakeholder_interview_reports")
    .update(patch)
    .eq("brand_id", brandId);
  if (error) throw error;
}
