import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase/errors";

export type CachedMarkdown = {
  markdown: string;
  status: string;
  generatedAt: string | null;
};

// Returns the LLM-generated markdown cached for a source file, or null if none
// (or the table isn't migrated yet — degrades gracefully).
export async function getCachedMarkdown(
  fileId: string,
): Promise<CachedMarkdown | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("deliverable_markdown")
    .select("markdown, status, generated_at")
    .eq("file_id", fileId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  const row = data as {
    markdown: string;
    status: string;
    generated_at: string | null;
  };
  return {
    markdown: row.markdown,
    status: row.status,
    generatedAt: row.generated_at,
  };
}

export async function setCachedMarkdown({
  fileId,
  subjectType,
  subjectId,
  markdown,
  status = "READY",
  error = null,
}: {
  fileId: string;
  subjectType: string | null;
  subjectId: string | null;
  markdown: string;
  status?: string;
  error?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error: upsertError } = await admin
    .from("deliverable_markdown")
    .upsert(
      {
        file_id: fileId,
        subject_type: subjectType,
        subject_id: subjectId,
        markdown,
        status,
        error,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "file_id" },
    );
  if (upsertError) {
    if (isMissingTableError(upsertError)) return;
    throw upsertError;
  }
}
