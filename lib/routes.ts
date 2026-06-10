// Single source of truth for the app's user-facing routes. Pages live under the
// `(app)` route group, so these slugs are top-level (no shared URL prefix) and
// intentionally match each page's displayed name and on-disk folder.
export const ROUTES = {
  home: "/home",
  brain: "/brand-integrated-brain",
  brainRoadmap: "/brand-integrated-brain/roadmap",
  brainRoadmapFuturesResearch:
    "/brand-integrated-brain/roadmap/futures-research",
  brainRoadmapStakeholderInterviews:
    "/brand-integrated-brain/roadmap/stakeholder-interviews",
  brainRoadmapCityModel: "/brand-integrated-brain/roadmap/city-model",
  agents: "/agents",
  documents: "/documents",
  settings: "/settings",
  modules: "/modules",
  // Questionnaire is Phase 1 of the Build Roadmap, so it lives under the brain
  // roadmap rather than at the top level — its URL mirrors the breadcrumb trail.
  questionnaire: "/brand-integrated-brain/roadmap/questionnaire",
  changeRequests: "/change-requests",
  createBrand: "/create-brand",
  invitations: "/invitations",
} as const;

export const agentPath = (slug: string) => `${ROUTES.agents}/${slug}`;
export const modulePath = (moduleId: string) => `${ROUTES.modules}/${moduleId}`;
export const questionnaireSectionPath = (sectionKey: string) =>
  `${ROUTES.questionnaire}/${sectionKey}`;

// First URL segment of every page rendered inside the `(app)` shell.
// Route groups don't appear in the pathname, so this allowlist is how the
// sidebar/breadcrumb and middleware recognize "an app page" without a shared
// URL prefix. Keep in sync with the folders under app/(app)/.
export const APP_ROOT_SEGMENTS = new Set([
  "home",
  "brand-integrated-brain",
  "agents",
  "documents",
  "settings",
  "modules",
  "change-requests",
  "create-brand",
  "invitations",
]);
