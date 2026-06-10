import "server-only";

import { randomUUID } from "node:crypto";

import {
  generateIntakeDocx,
  intakeDocxAsciiName,
  intakeDocxDisplayName,
} from "@/features/questionnaire/docx-generator";
import type { IntakeSnapshotJson } from "@/features/questionnaire/types";
import { privateFilesBucket } from "@/features/documents/storage";
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
  // Storage key: ASCII-safe, spaces hyphenated (e.g. `Onmind-Questionnaire.docx`).
  const storageName = intakeDocxAsciiName(snapshotJson.brand.name).replace(
    /\s+/g,
    "-",
  );
  const storagePath = `${brandId}/${fileId}/${storageName}`;

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
      original_name: intakeDocxDisplayName(snapshotJson.brand.name),
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

  const { error: snapshotError } = await admin
    .from("intake_snapshots")
    .update({ generated_docx_file_id: fileId })
    .eq("id", snapshotId);

  if (snapshotError) throw snapshotError;

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
