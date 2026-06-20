// Block-anchored, threaded comments shared by every reviewable deliverable
// (everything except the client-filled questionnaire).

export const reviewSubjectTypes = [
  "STAKEHOLDER_INTERVIEWS",
  "FUTURES_RESEARCH",
  "CITY_MODEL_DISTRICT",
  "VISUAL_DIRECTION",
  "COLOR_TYPE_SYSTEM",
  "ASSET_LIBRARY",
  "MODULE",
  "BRAND_DOC",
] as const;

export type ReviewSubjectType = (typeof reviewSubjectTypes)[number];

// Human-readable label per surface, used in notification titles.
export const reviewSubjectLabels: Record<ReviewSubjectType, string> = {
  STAKEHOLDER_INTERVIEWS: "Stakeholder Interviews",
  FUTURES_RESEARCH: "Futures Research",
  CITY_MODEL_DISTRICT: "City Model",
  VISUAL_DIRECTION: "Visual Direction",
  COLOR_TYPE_SYSTEM: "Color & Type System",
  ASSET_LIBRARY: "Asset Library",
  MODULE: "Module",
  BRAND_DOC: "Brand Document",
};

export type ReviewComment = {
  id: string;
  brandId: string;
  subjectType: ReviewSubjectType;
  subjectId: string;
  parentId: string | null;
  anchorId: string | null;
  anchorLabel: string | null;
  // Inline highlight: character offsets into the anchored block's plain text,
  // plus the quoted text. All null for whole-document / section-level comments.
  highlightStart: number | null;
  highlightEnd: number | null;
  highlightText: string | null;
  authorId: string | null;
  authorName: string | null;
  body: string;
  resolved: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CommentHighlight = {
  start: number;
  end: number;
  text: string;
};

export type AddReviewCommentInput = {
  subjectType: ReviewSubjectType;
  subjectId: string;
  anchorId: string | null;
  anchorLabel: string | null;
  body: string;
  parentId?: string | null;
  // Present only when the comment is anchored to a selected text range.
  highlight?: CommentHighlight | null;
  // Set only by the internal admin review surface (where the staff member has
  // no brand membership). The server verifies the subject belongs to this
  // brand before trusting it; client-membership callers leave it undefined.
  brandId?: string;
};

export type AddReviewCommentResult =
  | { ok: true; comment: ReviewComment }
  | { ok: false; message: string };

export type ReviewCommentMutationResult = { ok: boolean; message?: string };
