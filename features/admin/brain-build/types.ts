// Brain Build scheduling — the admin-side handle on Phase 04. One schedule per
// brand: a target_date that drives the brand-facing progress bar, and a
// built_at stamp that, once set, unlocks the Brand Brain chatbot.

export type BrainBuildSchedule = {
  brandId: string;
  // ISO date (YYYY-MM-DD) the brand is told its brain will be ready.
  targetDate: string;
  scheduledBy: string | null;
  // null until "Build Now" runs.
  builtAt: string | null;
  builtBy: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BrainBuildActionState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | {
      status: "success";
      message: string;
      // Populated by buildBrainNowAction so the panel can surface what shipped.
      builtAt?: string;
      syncedCount?: number;
      notifiedCount?: number;
    };

export const initialBrainBuildActionState: BrainBuildActionState = {
  status: "idle",
  message: "",
};
