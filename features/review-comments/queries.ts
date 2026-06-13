import "server-only";

import type {
  ReviewComment,
  ReviewSubjectType,
} from "@/features/review-comments/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isMissingColumnError,
  isMissingTableError,
} from "@/lib/supabase/errors";

type AuthorEmbed =
  | { full_name: string | null; email: string | null }
  | { full_name: string | null; email: string | null }[]
  | null;

type CommentRow = {
  id: string;
  brand_id: string;
  subject_type: string;
  subject_id: string;
  parent_id: string | null;
  anchor_id: string | null;
  anchor_label: string | null;
  highlight_start: number | null;
  highlight_end: number | null;
  highlight_text: string | null;
  author_id: string | null;
  body: string;
  resolved: boolean;
  created_at: string | null;
  updated_at: string | null;
  author: AuthorEmbed;
};

const COMMENT_SELECT =
  "id, brand_id, subject_type, subject_id, parent_id, anchor_id, anchor_label, highlight_start, highlight_end, highlight_text, author_id, body, resolved, created_at, updated_at, author:users_profile(full_name, email)";

// Pre-0046 select, without the highlight columns. Used as a fallback so the
// review surfaces keep rendering before the highlight migration is applied.
const COMMENT_SELECT_BASE =
  "id, brand_id, subject_type, subject_id, parent_id, anchor_id, anchor_label, author_id, body, resolved, created_at, updated_at, author:users_profile(full_name, email)";

function firstAuthor(
  author: AuthorEmbed,
): { full_name: string | null; email: string | null } | null {
  if (!author) return null;
  return Array.isArray(author) ? (author[0] ?? null) : author;
}

function mapRow(row: CommentRow): ReviewComment {
  const author = firstAuthor(row.author);
  return {
    id: row.id,
    brandId: row.brand_id,
    subjectType: row.subject_type as ReviewSubjectType,
    subjectId: row.subject_id,
    parentId: row.parent_id,
    anchorId: row.anchor_id,
    anchorLabel: row.anchor_label,
    highlightStart: row.highlight_start ?? null,
    highlightEnd: row.highlight_end ?? null,
    highlightText: row.highlight_text ?? null,
    authorId: row.author_id,
    authorName: author?.full_name ?? null,
    authorEmail: author?.email ?? null,
    body: row.body,
    resolved: row.resolved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// All comments for one deliverable surface, oldest first. The viewer groups
// them by anchor_id (null = whole-document) and threads them by parent_id.
// brandId is part of the key, not just an optimisation: city-model subject ids
// are district slugs shared by every brand, so an unscoped read would leak one
// brand's comments into another brand's workspace.
export async function listCommentsForSubject({
  subjectType,
  subjectId,
  brandId,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  brandId: string;
}): Promise<ReviewComment[]> {
  const admin = createAdminClient();
  const run = (columns: string) =>
    admin
      .from("review_comments")
      .select(columns)
      .eq("subject_type", subjectType)
      .eq("subject_id", subjectId)
      .eq("brand_id", brandId)
      .order("created_at", { ascending: true });

  let { data, error } = await run(COMMENT_SELECT);

  // Before migration 0046 the highlight columns don't exist — retry without
  // them so existing comments still load (highlights just aren't painted yet).
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await run(COMMENT_SELECT_BASE));
  }

  if (error) {
    // Degrade gracefully until migration 0041 is applied.
    if (isMissingTableError(error)) return [];
    throw error;
  }
  return ((data ?? []) as unknown as CommentRow[]).map(mapRow);
}

// Minimal lookup used to validate a reply target before inserting: the parent
// must exist, live on the same (subjectType, subjectId, brand), and itself be a
// root comment (threads are one level deep).
export async function getReplyParent(parentId: string): Promise<{
  subjectType: string;
  subjectId: string;
  brandId: string;
  parentId: string | null;
} | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("review_comments")
    .select("subject_type, subject_id, brand_id, parent_id")
    .eq("id", parentId)
    .maybeSingle();
  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  const row = data as {
    subject_type: string;
    subject_id: string;
    brand_id: string;
    parent_id: string | null;
  };
  return {
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    brandId: row.brand_id,
    parentId: row.parent_id,
  };
}
