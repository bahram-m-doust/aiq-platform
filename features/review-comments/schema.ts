import {
  reviewSubjectTypes,
  type ReviewSubjectType,
} from "@/features/review-comments/types";

const maxCommentLength = 4000;

export function isReviewSubjectType(value: string): value is ReviewSubjectType {
  return (reviewSubjectTypes as readonly string[]).includes(value);
}

export function validateCommentBody(body: string): {
  value: string | null;
  error: string | null;
} {
  const trimmed = body.trim();
  if (!trimmed) return { value: null, error: "Enter a comment." };
  if (trimmed.length > maxCommentLength) {
    return {
      value: null,
      error: `Comment must be ${maxCommentLength} characters or fewer.`,
    };
  }
  return { value: trimmed, error: null };
}

// A short, single-line excerpt of a comment for use in a notification body.
export function commentExcerpt(body: string, max = 140): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// Route (without hash) where a deliverable surface is reviewed. Used both to
// revalidate after a mutation and to build notification deep links.
export function subjectPathname(
  subjectType: ReviewSubjectType,
  subjectId: string,
): string {
  switch (subjectType) {
    case "STAKEHOLDER_INTERVIEWS":
      return "/brand-integrated-brain/roadmap/stakeholder-interviews";
    case "FUTURES_RESEARCH":
      return "/brand-integrated-brain/roadmap/futures-research";
    case "CITY_MODEL_DISTRICT":
      return `/brand-integrated-brain/roadmap/city-model/${subjectId}`;
    case "MODULE":
      return `/modules/${subjectId}`;
    case "BRAND_DOC":
      return "/brand-integrated-brain";
  }
}

// Deep link to an exact section, e.g. .../city-model/purpose-form#brand-purpose.
export function buildSubjectLinkPath(
  subjectType: ReviewSubjectType,
  subjectId: string,
  anchorId: string | null,
): string {
  const base = subjectPathname(subjectType, subjectId);
  return anchorId ? `${base}#${anchorId}` : base;
}
