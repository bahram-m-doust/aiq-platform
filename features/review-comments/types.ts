// Block-anchored, threaded comments shared by every reviewable deliverable
// (everything except the client-filled questionnaire).

export const reviewSubjectTypes = [
  "STAKEHOLDER_INTERVIEWS",
  "FUTURES_RESEARCH",
  "CITY_MODEL_DISTRICT",
  "MODULE",
  "BRAND_DOC",
] as const;

export type ReviewSubjectType = (typeof reviewSubjectTypes)[number];

// Human-readable label per surface, used in notification titles.
export const reviewSubjectLabels: Record<ReviewSubjectType, string> = {
  STAKEHOLDER_INTERVIEWS: "Stakeholder Interviews",
  FUTURES_RESEARCH: "Futures Research",
  CITY_MODEL_DISTRICT: "City Model",
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
  authorId: string | null;
  authorName: string | null;
  authorEmail: string | null;
  body: string;
  resolved: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AddReviewCommentInput = {
  subjectType: ReviewSubjectType;
  subjectId: string;
  anchorId: string | null;
  anchorLabel: string | null;
  body: string;
  parentId?: string | null;
};

export type AddReviewCommentResult =
  | { ok: true; comment: ReviewComment }
  | { ok: false; message: string };

export type ReviewCommentMutationResult = { ok: boolean; message?: string };
