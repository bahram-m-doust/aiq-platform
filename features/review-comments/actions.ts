"use server";

import { revalidatePath } from "next/cache";

import { requireDeliverableReviewer } from "@/features/review-deliverables/reviewer";
import {
  createComment,
  deleteComment,
  editComment,
  setCommentResolved,
} from "@/features/review-comments/mutation-service";
import {
  buildSubjectLinkPath,
  commentExcerpt,
  isReviewSubjectType,
  subjectPathname,
  validateCommentBody,
} from "@/features/review-comments/schema";
import {
  reviewSubjectLabels,
  type AddReviewCommentInput,
  type AddReviewCommentResult,
  type ReviewCommentMutationResult,
} from "@/features/review-comments/types";
import { logServerError } from "@/lib/logging/server";

function reviewerName(authorName: string | null, authorEmail: string | null) {
  return authorName ?? authorEmail ?? "A reviewer";
}

export async function addReviewCommentAction(
  input: AddReviewCommentInput,
): Promise<AddReviewCommentResult> {
  if (!isReviewSubjectType(input.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(input.subjectType, input.subjectId);
  const reviewer = await requireDeliverableReviewer(returnTo);
  if (!reviewer) {
    return { ok: false, message: "You cannot comment on this document." };
  }

  const { value, error } = validateCommentBody(input.body);
  if (!value) {
    return { ok: false, message: error ?? "Enter a comment." };
  }

  const sectionLabel = input.anchorLabel?.trim() || null;
  const subjectLabel = reviewSubjectLabels[input.subjectType];
  const notifyTitle = input.parentId
    ? `New reply on ${subjectLabel}`
    : sectionLabel
      ? `New comment on “${sectionLabel}” — ${subjectLabel}`
      : `New comment on ${subjectLabel}`;
  const notifyBody = `${reviewerName(
    reviewer.authorName,
    reviewer.authorEmail,
  )}: ${commentExcerpt(value)}`;

  try {
    const comment = await createComment({
      brandId: reviewer.brandId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      authorId: reviewer.profileId,
      body: value,
      anchorId: input.anchorId,
      anchorLabel: sectionLabel,
      parentId: input.parentId ?? null,
      linkPath: buildSubjectLinkPath(
        input.subjectType,
        input.subjectId,
        input.anchorId,
      ),
      notifyTitle,
      notifyBody,
    });
    revalidatePath(returnTo);
    return {
      ok: true,
      comment: {
        ...comment,
        authorName: reviewer.authorName,
        authorEmail: reviewer.authorEmail,
      },
    };
  } catch (caught) {
    logServerError({
      label: "[review-comments] add comment failed",
      error: caught,
      metadata: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        profileId: reviewer.profileId,
      },
    });
    return { ok: false, message: "Could not save your comment. Try again." };
  }
}

export async function editReviewCommentAction(args: {
  subjectType: string;
  subjectId: string;
  commentId: string;
  body: string;
}): Promise<ReviewCommentMutationResult> {
  if (!isReviewSubjectType(args.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(args.subjectType, args.subjectId);
  const reviewer = await requireDeliverableReviewer(returnTo);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  const { value, error } = validateCommentBody(args.body);
  if (!value) return { ok: false, message: error ?? "Enter a comment." };

  try {
    await editComment({
      commentId: args.commentId,
      authorId: reviewer.profileId,
      body: value,
    });
    revalidatePath(returnTo);
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[review-comments] edit comment failed",
      error: caught,
      metadata: { commentId: args.commentId, profileId: reviewer.profileId },
    });
    return { ok: false, message: "Could not update the comment." };
  }
}

export async function deleteReviewCommentAction(args: {
  subjectType: string;
  subjectId: string;
  commentId: string;
}): Promise<ReviewCommentMutationResult> {
  if (!isReviewSubjectType(args.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(args.subjectType, args.subjectId);
  const reviewer = await requireDeliverableReviewer(returnTo);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  try {
    await deleteComment({
      commentId: args.commentId,
      authorId: reviewer.profileId,
    });
    revalidatePath(returnTo);
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[review-comments] delete comment failed",
      error: caught,
      metadata: { commentId: args.commentId, profileId: reviewer.profileId },
    });
    return { ok: false, message: "Could not delete the comment." };
  }
}

export async function resolveReviewCommentAction(args: {
  subjectType: string;
  subjectId: string;
  commentId: string;
  resolved: boolean;
}): Promise<ReviewCommentMutationResult> {
  if (!isReviewSubjectType(args.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(args.subjectType, args.subjectId);
  const reviewer = await requireDeliverableReviewer(returnTo);
  if (!reviewer) return { ok: false, message: "Not allowed." };

  try {
    await setCommentResolved({
      commentId: args.commentId,
      resolved: args.resolved,
    });
    revalidatePath(returnTo);
    return { ok: true };
  } catch (caught) {
    logServerError({
      label: "[review-comments] resolve comment failed",
      error: caught,
      metadata: { commentId: args.commentId, profileId: reviewer.profileId },
    });
    return { ok: false, message: "Could not update the comment." };
  }
}
