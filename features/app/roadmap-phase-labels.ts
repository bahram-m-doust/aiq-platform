import type { AestheticsKind } from "@/lib/routes";

export const ROADMAP_PHASE_LABELS = {
  questionnaires: "Brand Research · Phase 01",
  stakeholderInterviews: "Brand Research · Step 2",
  futuresResearch: "Brand Research · Step 3",
  cityModel: "Brand Strategy · Step 1",
  cityModelDistrict: "Brand Strategy · Step 1",
} as const;

export const AESTHETICS_PHASE_LABELS: Record<AestheticsKind, string> = {
  VISUAL_DIRECTION: "Aesthetics · Step 1",
  COLOR_TYPE_SYSTEM: "Aesthetics · Step 2",
  ASSET_LIBRARY: "Aesthetics · Step 3",
};
