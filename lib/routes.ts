// Single source of truth for the app's user-facing routes. Pages live under the
// `(app)` route group, so these slugs are top-level (no shared URL prefix) and
// intentionally match each page's displayed name and on-disk folder.
export const ROUTES = {
  home: "/home",
  brain: "/integrated-brand-brain",
  brainBrand: "/integrated-brand-brain/brand-brain",
  brainRoadmap: "/integrated-brand-brain/roadmap",
  brainRoadmapFuturesResearch:
    "/integrated-brand-brain/roadmap/futures-research",
  brainRoadmapStakeholderInterviews:
    "/integrated-brand-brain/roadmap/stakeholder-interviews",
  brainRoadmapCityModel: "/integrated-brand-brain/roadmap/city-model",
  brainRoadmapAesthetics: "/integrated-brand-brain/roadmap/aesthetics",
  agents: "/agents",
  documents: "/documents",
  settings: "/settings",
  modules: "/modules",
  // Questionnaire is Phase 1 of the Build Roadmap, so it lives under the brain
  // roadmap rather than at the top level — its URL mirrors the breadcrumb trail.
  questionnaire: "/integrated-brand-brain/roadmap/questionnaire",
  changeRequests: "/change-requests",
  createBrand: "/create-brand",
  invitations: "/invitations",
} as const;

export const agentPath = (slug: string) => `${ROUTES.agents}/${slug}`;
export const modulePath = (moduleId: string) => `${ROUTES.modules}/${moduleId}`;
export const questionnaireSectionPath = (sectionKey: string) =>
  `${ROUTES.questionnaire}/${sectionKey.toLowerCase()}`;

// Aesthetics (Phase 3) deliverables — one client review page per kind. The
// slug ↔ kind mapping lives here as the single source of truth shared by the
// feature module and the review-comments deep-link builder.
export const aestheticsKindSlugs = {
  VISUAL_DIRECTION: "visual-direction",
  COLOR_TYPE_SYSTEM: "color-type-system",
  ASSET_LIBRARY: "asset-library",
} as const;

export type AestheticsKind = keyof typeof aestheticsKindSlugs;

export const aestheticsDeliverablePath = (slug: string) =>
  `${ROUTES.brainRoadmapAesthetics}/${slug}`;

// First URL segment of every page rendered inside the `(app)` shell.
// Route groups don't appear in the pathname, so this allowlist is how the
// sidebar/breadcrumb and middleware recognize "an app page" without a shared
// URL prefix. Keep in sync with the folders under app/(app)/.
export const APP_ROOT_SEGMENTS = new Set([
  "home",
  "integrated-brand-brain",
  "agents",
  "documents",
  "settings",
  "modules",
  "change-requests",
  "create-brand",
  "invitations",
]);
