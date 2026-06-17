import "server-only";

import type {
  CommentHighlight,
  ReviewComment,
  ReviewSubjectType,
} from "@/features/review-comments/types";
import { DomainError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export type CommentNotifyAudience = "INTERNAL_TEAM" | "CLIENT";

// Creates a comment and fans out a notification to the other party in one txn
// (via the add_review_comment RPC), so a comment can never exist without its
// notification. A client comment notifies INTERNAL_TEAM; an internal reply
// notifies the brand's CLIENT reviewers. Returns the new comment with author
// fields left null — the caller fills them from the signed-in profile.
export async function createComment({
  brandId,
  subjectType,
  subjectId,
  authorId,
  body,
  anchorId,
  anchorLabel,
  highlight = null,
  parentId = null,
  linkPath,
  notifyTitle,
  notifyBody,
  notifyAudience,
}: {
  brandId: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  authorId: string;
  body: string;
  anchorId: string | null;
  anchorLabel: string | null;
  highlight?: CommentHighlight | null;
  parentId?: string | null;
  linkPath: string | null;
  notifyTitle: string;
  notifyBody: string | null;
  notifyAudience: CommentNotifyAudience;
}): Promise<ReviewComment> {
  const admin = createAdminClient();
  const baseArgs = {
    p_brand_id: brandId,
    p_subject_type: subjectType,
    p_subject_id: subjectId,
    p_author_id: authorId,
    p_body: body,
    p_anchor_id: anchorId,
    p_anchor_label: anchorLabel,
    p_parent_id: parentId,
    p_link_path: linkPath,
    p_notify_title: notifyTitle,
    p_notify_body: notifyBody,
  };
  const highlightArgs = {
    p_highlight_start: highlight?.start ?? null,
    p_highlight_end: highlight?.end ?? null,
    p_highlight_text: highlight?.text ?? null,
  };

  let { data, error } = await admin.rpc("add_review_comment", {
    ...baseArgs,
    p_notify_audience: notifyAudience,
    ...highlightArgs,
  });

  // Retry against older RPC signatures so a not-yet-migrated DB keeps working:
  // first drop the highlight params (pre-0046), then the audience too (pre-0044).
  if (error && error.code === "PGRST202") {
    ({ data, error } = await admin.rpc("add_review_comment", {
      ...baseArgs,
      p_notify_audience: notifyAudience,
    }));
  }
  if (error && error.code === "PGRST202") {
    ({ data, error } = await admin.rpc("add_review_comment", baseArgs));
  }

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  const commentId =
    result && typeof result.comment_id === "string" ? result.comment_id : null;
  const createdAt =
    result && typeof result.created_at === "string" ? result.created_at : null;
  if (!commentId) {
    throw new DomainError("review_comment", "Comment could not be created.");
  }

  return {
    id: commentId,
    brandId,
    subjectType,
    subjectId,
    parentId: parentId ?? null,
    anchorId,
    anchorLabel,
    highlightStart: highlight?.start ?? null,
    highlightEnd: highlight?.end ?? null,
    highlightText: highlight?.text ?? null,
    authorId,
    authorName: null,
    body,
    resolved: false,
    createdAt,
    updatedAt: createdAt,
  };
}

async function requireOwnedComment(
  result: PromiseLike<{ data: { id: string } | null; error: unknown }>,
): Promise<void> {
  const { data, error } = await result;
  if (error) throw error;
  if (!data) {
    throw new DomainError(
      "review_comment",
      "The comment no longer exists or is not yours.",
    );
  }
}

// Every mutation is double-keyed: by author (edit/delete are author-only) AND
// by brand, so a forged commentId belonging to another brand never matches.
export async function editComment({
  commentId,
  authorId,
  brandId,
  body,
}: {
  commentId: string;
  authorId: string;
  brandId: string;
  body: string;
}): Promise<void> {
  const admin = createAdminClient();
  await requireOwnedComment(
    admin
      .from("review_comments")
      .update({ body, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("author_id", authorId)
      .eq("brand_id", brandId)
      .select("id")
      .maybeSingle(),
  );
}

export async function deleteComment({
  commentId,
  authorId,
  brandId,
}: {
  commentId: string;
  authorId: string;
  brandId: string;
}): Promise<void> {
  const admin = createAdminClient();
  await requireOwnedComment(
    admin
      .from("review_comments")
      .delete()
      .eq("id", commentId)
      .eq("author_id", authorId)
      .eq("brand_id", brandId)
      .select("id")
      .maybeSingle(),
  );
}

// Resolving is a review-team action, so it is not restricted to the author —
// but it is still scoped to the reviewer's brand.
export async function setCommentResolved({
  commentId,
  brandId,
  resolved,
}: {
  commentId: string;
  brandId: string;
  resolved: boolean;
}): Promise<void> {
  const admin = createAdminClient();
  await requireOwnedComment(
    admin
      .from("review_comments")
      .update({ resolved, updated_at: new Date().toISOString() })
      .eq("id", commentId)
      .eq("brand_id", brandId)
      .select("id")
      .maybeSingle(),
  );
}
