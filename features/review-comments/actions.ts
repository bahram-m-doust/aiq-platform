"use server";

import { revalidatePath } from "next/cache";

import { requireUserProfile } from "@/features/auth/queries";
import { canViewAdminModulesRole } from "@/features/modules/schema";
import { requireDeliverableReviewer } from "@/features/review-deliverables/reviewer";
import {
  createComment,
  deleteComment,
  editComment,
  setCommentResolved,
  type CommentNotifyAudience,
} from "@/features/review-comments/mutation-service";
import { getReplyParent } from "@/features/review-comments/queries";
import {
  buildNotificationLink,
  commentExcerpt,
  isReviewSubjectType,
  subjectPathname,
  validateCommentBody,
} from "@/features/review-comments/schema";
import {
  getReviewSubjectBrand,
  verifyReviewSubject,
} from "@/features/review-comments/subject-registry";
import {
  reviewSubjectLabels,
  type AddReviewCommentInput,
  type AddReviewCommentResult,
  type CommentHighlight,
  type ReviewCommentMutationResult,
  type ReviewSubjectType,
} from "@/features/review-comments/types";
import { slugifyAnchor } from "@/lib/markdown/blocks";
import { logServerError } from "@/lib/logging/server";
import { isUuid } from "@/lib/utils";

const MAX_ANCHOR_ID_LENGTH = 200;
const MAX_ANCHOR_LABEL_LENGTH = 300;
const MAX_HIGHLIGHT_TEXT_LENGTH = 2000;
// Guard against absurd offsets from a forged request; a block's plain text is
// never anywhere near this long.
const MAX_HIGHLIGHT_OFFSET = 1_000_000;

type CommentAuthor = {
  profileId: string;
  brandId: string;
  authorName: string | null;
  authorEmail: string | null;
  // Notifications flow toward the other party: a client (brand member) comment
  // notifies the internal team; an internal-team comment notifies the client.
  notifyAudience: CommentNotifyAudience;
};

// Resolves who is commenting. Brand members (OWNER / EXECUTIVE_MANAGER) act for
// their own brand; internal users (PLATFORM_OWNER / SUPERVISOR /
// INTERNAL_SPECIALIST) without a membership act for a brand resolved from the
// admin review context, the parent comment (replies), or the subject row —
// always re-verified to actually own the subject before it is trusted.
async function resolveCommentAuthor(
  subjectType: ReviewSubjectType,
  subjectId: string,
  returnTo: string,
  contextBrandId?: string,
): Promise<CommentAuthor | null> {
  const reviewer = await requireDeliverableReviewer(returnTo);
  if (reviewer) {
    const ownsSubject = await verifyReviewSubject({
      subjectType,
      subjectId,
      brandId: reviewer.brandId,
    });
    if (!ownsSubject) return null;
    return { ...reviewer, notifyAudience: "INTERNAL_TEAM" };
  }

  const { profile } = await requireUserProfile(returnTo);
  if (!canViewAdminModulesRole(profile.global_role)) return null;

  // Prefer the admin-context brand (from the verified deep link); fall back to
  // deriving it from the subject. Either way it must own the subject.
  const candidateBrandId =
    contextBrandId && isUuid(contextBrandId)
      ? contextBrandId
      : await getReviewSubjectBrand({ subjectType, subjectId });
  if (!candidateBrandId) return null;
  const ownsSubject = await verifyReviewSubject({
    subjectType,
    subjectId,
    brandId: candidateBrandId,
  });
  if (!ownsSubject) return null;

  return {
    profileId: profile.id,
    brandId: candidateBrandId,
    authorName: profile.full_name ?? null,
    authorEmail: profile.email ?? null,
    notifyAudience: "CLIENT",
  };
}

function reviewerName(authorName: string | null, authorEmail: string | null) {
  return authorName ?? authorEmail ?? "A reviewer";
}

// Anchor ids come from the client; re-slugify server-side so only the same
// alphabet the block splitter produces (unicode letters/digits/hyphens) can be
// stored or embedded into notification deep links.
function sanitizeAnchorId(value: string | null | undefined): string | null {
  if (!value) return null;
  return slugifyAnchor(value).slice(0, MAX_ANCHOR_ID_LENGTH) || null;
}

function sanitizeAnchorLabel(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_ANCHOR_LABEL_LENGTH);
}

// A highlight range is trusted only if it is internally consistent: both
// offsets are non-negative integers, the range is non-empty, and it carries the
// quoted text. Anything malformed degrades to a section-level comment (null)
// rather than rejecting the whole comment.
function sanitizeHighlight(
  value: CommentHighlight | null | undefined,
): CommentHighlight | null {
  if (!value) return null;
  const { start, end, text } = value;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  if (start < 0 || end <= start) return null;
  if (end > MAX_HIGHLIGHT_OFFSET) return null;
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return null;
  return { start, end, text: trimmed.slice(0, MAX_HIGHLIGHT_TEXT_LENGTH) };
}

export async function addReviewCommentAction(
  input: AddReviewCommentInput,
): Promise<AddReviewCommentResult> {
  if (!isReviewSubjectType(input.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(input.subjectType, input.subjectId);
  const { value, error } = validateCommentBody(input.body);
  if (!value) {
    return { ok: false, message: error ?? "Enter a comment." };
  }

  // Resolving the author also proves subject ownership: brand members are
  // checked against their own brand (IDOR guard); internal users derive the
  // brand from the subject row itself.
  const reviewer = await resolveCommentAuthor(
    input.subjectType,
    input.subjectId,
    returnTo,
    input.brandId,
  );
  if (!reviewer) {
    return { ok: false, message: "You cannot comment on this document." };
  }

  try {
    // A reply must target a root comment on the same subject and brand.
    const parentId = input.parentId ?? null;
    if (parentId) {
      if (!isUuid(parentId)) {
        return { ok: false, message: "Comment thread not found." };
      }
      const parent = await getReplyParent(parentId);
      if (
        !parent ||
        parent.brandId !== reviewer.brandId ||
        parent.subjectType !== input.subjectType ||
        parent.subjectId !== input.subjectId ||
        parent.parentId !== null
      ) {
        return { ok: false, message: "Comment thread not found." };
      }
    }

    const anchorId = sanitizeAnchorId(input.anchorId);
    // Only root comments carry a highlight; a reply inherits its parent's range.
    const highlight = parentId ? null : sanitizeHighlight(input.highlight);
    // A highlight's quoted text is the most useful section label (it is what the
    // reviewer actually selected); fall back to the block heading otherwise.
    const sectionLabel = highlight
      ? sanitizeAnchorLabel(highlight.text)
      : sanitizeAnchorLabel(input.anchorLabel);
    const subjectLabel = reviewSubjectLabels[input.subjectType];
    const notifyTitle = parentId
      ? `New reply on ${subjectLabel}`
      : sectionLabel
        ? `New comment on “${sectionLabel}” — ${subjectLabel}`
        : `New comment on ${subjectLabel}`;
    const notifyBody = `${reviewerName(
      reviewer.authorName,
      reviewer.authorEmail,
    )}: ${commentExcerpt(value)}`;

    const comment = await createComment({
      brandId: reviewer.brandId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      authorId: reviewer.profileId,
      body: value,
      anchorId,
      anchorLabel: sectionLabel,
      highlight,
      parentId,
      // The link targets whoever receives the notification (the other party).
      linkPath: buildNotificationLink({
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        anchorId,
        audience: reviewer.notifyAudience,
        brandId: reviewer.brandId,
      }),
      notifyTitle,
      notifyBody,
      notifyAudience: reviewer.notifyAudience,
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
  brandId?: string;
}): Promise<ReviewCommentMutationResult> {
  if (!isReviewSubjectType(args.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(args.subjectType, args.subjectId);
  const reviewer = await resolveCommentAuthor(
    args.subjectType,
    args.subjectId,
    returnTo,
    args.brandId,
  );
  if (!reviewer) return { ok: false, message: "Not allowed." };
  if (!isUuid(args.commentId)) {
    return { ok: false, message: "Comment not found." };
  }

  const { value, error } = validateCommentBody(args.body);
  if (!value) return { ok: false, message: error ?? "Enter a comment." };

  try {
    await editComment({
      commentId: args.commentId,
      authorId: reviewer.profileId,
      brandId: reviewer.brandId,
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
  brandId?: string;
}): Promise<ReviewCommentMutationResult> {
  if (!isReviewSubjectType(args.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(args.subjectType, args.subjectId);
  const reviewer = await resolveCommentAuthor(
    args.subjectType,
    args.subjectId,
    returnTo,
    args.brandId,
  );
  if (!reviewer) return { ok: false, message: "Not allowed." };
  if (!isUuid(args.commentId)) {
    return { ok: false, message: "Comment not found." };
  }

  try {
    await deleteComment({
      commentId: args.commentId,
      authorId: reviewer.profileId,
      brandId: reviewer.brandId,
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
  brandId?: string;
}): Promise<ReviewCommentMutationResult> {
  if (!isReviewSubjectType(args.subjectType)) {
    return { ok: false, message: "Unknown document type." };
  }
  const returnTo = subjectPathname(args.subjectType, args.subjectId);
  const reviewer = await resolveCommentAuthor(
    args.subjectType,
    args.subjectId,
    returnTo,
    args.brandId,
  );
  if (!reviewer) return { ok: false, message: "Not allowed." };
  if (!isUuid(args.commentId)) {
    return { ok: false, message: "Comment not found." };
  }

  try {
    await setCommentResolved({
      commentId: args.commentId,
      brandId: reviewer.brandId,
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
