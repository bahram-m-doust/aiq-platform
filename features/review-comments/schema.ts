import {
  reviewSubjectTypes,
  type ReviewSubjectType,
} from "@/features/review-comments/types";
import {
  ROUTES,
  aestheticsDeliverablePath,
  aestheticsKindSlugs,
  modulePath,
} from "@/lib/routes";

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
      return ROUTES.brainRoadmapStakeholderInterviews;
    case "FUTURES_RESEARCH":
      return ROUTES.brainRoadmapFuturesResearch;
    case "CITY_MODEL_DISTRICT":
      return `${ROUTES.brainRoadmapCityModel}/${subjectId}`;
    case "VISUAL_DIRECTION":
    case "COLOR_TYPE_SYSTEM":
    case "ASSET_LIBRARY":
      // One review page per kind; the kind (not the row id) selects the page.
      return aestheticsDeliverablePath(aestheticsKindSlugs[subjectType]);
    case "MODULE":
      return modulePath(subjectId);
    case "BRAND_DOC":
      return ROUTES.brain;
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

// The route on which internal staff (no brand membership) review a deliverable.
export const ADMIN_REVIEW_PATH = "/admin/review";

// Deep link for a notification, pointed at the recipient's route: clients land
// on the client review page; the internal team lands on the admin review page
// (which carries the brand, since internal staff have no membership to infer
// it from). Always relative, so the bell's open-redirect guard accepts it.
export function buildNotificationLink({
  subjectType,
  subjectId,
  anchorId,
  audience,
  brandId,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  anchorId: string | null;
  audience: "INTERNAL_TEAM" | "CLIENT";
  brandId: string;
}): string {
  if (audience === "CLIENT") {
    return buildSubjectLinkPath(subjectType, subjectId, anchorId);
  }
  const params = new URLSearchParams({
    subjectType,
    subjectId,
    brandId,
  });
  const base = `${ADMIN_REVIEW_PATH}?${params.toString()}`;
  return anchorId ? `${base}#${anchorId}` : base;
}
