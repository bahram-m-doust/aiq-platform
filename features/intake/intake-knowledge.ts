import "server-only";

import { randomUUID } from "node:crypto";

import { generateIntakeDocx } from "@/features/intake/docx-generator";
import type { IntakeSnapshotJson } from "@/features/intake/types";
import { privateFilesBucket } from "@/features/files/storage";
import { logAudit } from "@/lib/audit/logAudit";
import { createAdminClient } from "@/lib/supabase/admin";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function createIntakeKnowledgeFile({
  brandId,
  snapshotId,
  snapshotJson,
  profileId,
}: {
  brandId: string;
  snapshotId: string;
  snapshotJson: IntakeSnapshotJson;
  profileId: string;
}): Promise<{ fileId: string }> {
  const buffer = await generateIntakeDocx(snapshotJson);

  const fileId = randomUUID();
  const storagePath = `${brandId}/${fileId}/Brand-Intake.docx`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(privateFilesBucket)
    .upload(storagePath, buffer, {
      cacheControl: "3600",
      contentType: DOCX_MIME,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { error: fileError } = await admin
    .from("files")
    .insert({
      id: fileId,
      brand_id: brandId,
      storage_path: storagePath,
      original_name: "Brand Intake.docx",
      mime_type: DOCX_MIME,
      size_bytes: buffer.length,
      visibility: "HELIO_INTERNAL",
      status: "RAG_APPROVED",
      uploaded_by: profileId,
    });

  if (fileError) throw fileError;

  const { error: knowledgeError } = await admin
    .from("knowledge_files")
    .insert({
      brand_id: brandId,
      module_id: null,
      file_id: fileId,
      rag_status: "RAG_APPROVED",
      approved_by_supervisor: profileId,
      approved_by_platform_owner: profileId,
    });

  if (knowledgeError) throw knowledgeError;

  await admin
    .from("intake_snapshots")
    .update({ generated_docx_file_id: fileId })
    .eq("id", snapshotId);

  await logAudit({
    actorUserId: profileId,
    brandId,
    action: "intake_knowledge_generated",
    entityType: "file",
    entityId: fileId,
    after: {
      snapshot_id: snapshotId,
      file_id: fileId,
      storage_path: storagePath,
      size_bytes: buffer.length,
    },
  });

  return { fileId };
}
