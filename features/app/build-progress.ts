import "server-only";

import { CITY_MODEL_DISTRICTS } from "@/features/app/city-model";
import { getApprovedCityModelDistrictCount } from "@/features/city-model-deliverables/queries";
import { getFuturesResearchReportRowByBrand } from "@/features/futures-research/queries";
import type { FuturesResearchReportStatus } from "@/features/futures-research/types";
import type { IntakePageData } from "@/features/questionnaire/types";
import { getStakeholderReportRowByBrand } from "@/features/stakeholder-interviews/queries";
import type { StakeholderReportStatus } from "@/features/stakeholder-interviews/types";
import { getAestheticsRowsByBrand } from "@/features/aesthetics/queries";
import type { AestheticsDeliverableStatus } from "@/features/aesthetics/types";
import { getBrainBuildScheduleForBrand } from "@/features/admin/brain-build/queries";
import {
  ROUTES,
  aestheticsDeliverablePath,
  aestheticsKindSlugs,
  type AestheticsKind,
} from "@/lib/routes";
import { createAdminClient } from "@/lib/supabase/admin";

export type PhaseStatus = "locked" | "active" | "complete";

export type SubstepState =
  | "done"
  | "in-progress"
  | "awaiting-review"
  | "locked";

export type SubstepProgress = {
  id: string;
  title: string;
  description: string;
  progress: number;
  state: SubstepState;
  // When set, the substep navigates to this route instead of opening the
  // in-app detail overlay (e.g. the City Model page).
  href?: string;
};

export type PhaseProgress = {
  phase: 1 | 2 | 3 | 4;
  key: "questionnaires" | "strategies" | "aesthetics" | "brain_build";
  title: string;
  description: string;
  iconKind: "clipboard" | "spark" | "palette" | "chip";
  status: PhaseStatus;
  percent: number;
  stepsDone: number;
  stepsTotal: number;
  substeps: SubstepProgress[];
};

// The brand-facing slice of the Brain Build schedule. Drives Phase 04's
// "waiting for Bextudio" message, the animated progress bar, and (once builtAt
// is set) the unlocked Brand Brain chatbot.
export type BrainBuildScheduleView = {
  // ISO date (YYYY-MM-DD) the brand is told its brain will be ready.
  targetDate: string;
  // ISO timestamp the schedule was first created — the progress bar's start.
  scheduledAt: string | null;
  // null until Bextudio runs "Build Now".
  builtAt: string | null;
};

export type BrandBuildProgress = {
  brandId: string;
  brandName: string;
  overallPercent: number;
  stepsDone: number;
  stepsTotal: number;
  activePhase: PhaseProgress | null;
  phases: [PhaseProgress, PhaseProgress, PhaseProgress, PhaseProgress];
  brainBuild: BrainBuildScheduleView | null;
};

type IntakeRow = {
  id: string;
  completion_percent: number | null;
  status: string;
};

type KnowledgeBaseRow = {
  status: string | null;
};

type KnowledgeFileRow = { id: string };
type AgentEntitlementRow = { id: string };

async function getStakeholderStatusSafe(
  brandId: string,
): Promise<StakeholderReportStatus | null> {
  try {
    const row = await getStakeholderReportRowByBrand(brandId);
    if (!row) return null;
    if (
      row.status === "CLIENT_REVIEW" ||
      row.status === "CHANGES_REQUESTED" ||
      row.status === "APPROVED"
    ) {
      return row.status;
    }
    return "PENDING_UPLOAD";
  } catch {
    // Table not migrated yet, or a transient error — treat as not started.
    return null;
  }
}

function stakeholderSubstep(
  questionnairesDone: boolean,
  status: StakeholderReportStatus | null,
): { state: SubstepState; progress: number } {
  if (!questionnairesDone) return { state: "locked", progress: 0 };
  switch (status) {
    case "APPROVED":
      return { state: "done", progress: 100 };
    case "CLIENT_REVIEW":
      return { state: "awaiting-review", progress: 50 };
    case "CHANGES_REQUESTED":
      return { state: "in-progress", progress: 50 };
    default:
      // PENDING_UPLOAD / no report — the Bextudio team is preparing it.
      return { state: "in-progress", progress: 0 };
  }
}

async function getFuturesResearchStatusSafe(
  brandId: string,
): Promise<FuturesResearchReportStatus | null> {
  try {
    const row = await getFuturesResearchReportRowByBrand(brandId);
    if (!row) return null;
    if (
      row.status === "CLIENT_REVIEW" ||
      row.status === "CHANGES_REQUESTED" ||
      row.status === "APPROVED"
    ) {
      return row.status;
    }
    return "PENDING_UPLOAD";
  } catch {
    // Table not migrated yet, or a transient error — treat as not started.
    return null;
  }
}

// Mirrors stakeholderSubstep. Unlocks once the questionnaires are done —
// independent of Stakeholder Interviews, so each report is reviewed and
// approved on its own.
function futuresResearchSubstep(
  unlocked: boolean,
  status: FuturesResearchReportStatus | null,
): { state: SubstepState; progress: number } {
  if (!unlocked) return { state: "locked", progress: 0 };
  switch (status) {
    case "APPROVED":
      return { state: "done", progress: 100 };
    case "CLIENT_REVIEW":
      return { state: "awaiting-review", progress: 50 };
    case "CHANGES_REQUESTED":
      return { state: "in-progress", progress: 50 };
    default:
      // PENDING_UPLOAD / no report — the Bextudio team is preparing it.
      return { state: "in-progress", progress: 0 };
  }
}

function getBrandResearchProgress({
  intakeLocked,
  percent,
  sessionExists,
  stakeholderStatus,
  futuresResearchStatus,
}: {
  intakeLocked: boolean;
  percent: number;
  sessionExists: boolean;
  stakeholderStatus: StakeholderReportStatus | null;
  futuresResearchStatus: FuturesResearchReportStatus | null;
}) {
  const intakeStarted = sessionExists || percent > 0;
  const questionnairesComplete = percent === 100;
  const questionnairesDone = intakeLocked;

  let questionnairesState: SubstepState = "locked";
  if (questionnairesDone) questionnairesState = "done";
  else if (questionnairesComplete) questionnairesState = "in-progress";
  else if (intakeStarted) questionnairesState = "in-progress";

  const stakeholder = stakeholderSubstep(questionnairesDone, stakeholderStatus);
  const stakeholderDone = questionnairesDone && stakeholderStatus === "APPROVED";
  const futures = futuresResearchSubstep(
    stakeholderDone,
    futuresResearchStatus,
  );

  const substeps: SubstepProgress[] = [
    {
      id: "questionnaires",
      title: "Questionnaires",
      description:
        "Capture the raw signal - voice, audience, identity - direct from the brand.",
      progress: percent,
      state: questionnairesState,
    },
    {
      id: "stakeholder-interviews",
      title: "Stakeholder Interviews Report",
      description:
        "Interview founders and key stakeholders to surface intent, nuance and ambition.",
      progress: stakeholder.progress,
      state: stakeholder.state,
    },
    {
      id: "futures-research",
      title: "Futures Research",
      description:
        "Map the trends and future scenarios shaping where the brand can go.",
      progress: futures.progress,
      state: futures.state,
    },
  ];

  const allSubstepsDone = substeps.every((substep) => substep.state === "done");
  const completedSubsteps = substeps.filter(
    (substep) => substep.state === "done",
  ).length;
  const phasePercent = Math.round(
    substeps.reduce((sum, substep) => sum + substep.progress, 0) /
      substeps.length,
  );

  let status: PhaseStatus = "locked";
  if (allSubstepsDone) status = "complete";
  else if (intakeStarted) status = "active";

  return {
    percent: phasePercent,
    status,
    stepsDone: completedSubsteps,
    stepsTotal: substeps.length,
    substeps,
  };
}

async function getIntakeProgress(
  brandId: string,
  stakeholderStatus: StakeholderReportStatus | null,
  futuresResearchStatus: FuturesResearchReportStatus | null,
) {
  const admin = createAdminClient();

  const [sessionResult, questionsResult] = await Promise.all([
    admin
      .from("intake_sessions")
      .select("id, completion_percent, status")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("questions").select("*", { count: "exact", head: true }),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (questionsResult.error) throw questionsResult.error;

  const session = sessionResult.data as IntakeRow | null;
  const isLocked = session?.status === "LOCKED";
  const percent = isLocked ? 100 : session?.completion_percent ?? 0;

  return getBrandResearchProgress({
    intakeLocked: isLocked,
    percent,
    sessionExists: Boolean(session),
    stakeholderStatus,
    futuresResearchStatus,
  });
}

function getIntakeProgressFromPageData(
  data: IntakePageData,
  stakeholderStatus: StakeholderReportStatus | null,
  futuresResearchStatus: FuturesResearchReportStatus | null,
) {
  const isLocked = data.session.status === "LOCKED";
  const percent = isLocked ? 100 : data.completion.completionPercent;

  return getBrandResearchProgress({
    intakeLocked: isLocked,
    percent,
    sessionExists: Boolean(data.session),
    stakeholderStatus,
    futuresResearchStatus,
  });
}

// Cosmetic schedule progress used for the Phase 04 headline percent — mirrors
// the client-side bar in BrandBuildView. Linear from scheduled date to target,
// capped just shy of full until the brain actually ships.
function scheduleProgressPercent(
  targetDate: string,
  scheduledAt: string | null,
): number {
  const start = scheduledAt ? new Date(scheduledAt).getTime() : Date.now();
  const end = new Date(`${targetDate}T23:59:59`).getTime();
  const now = Date.now();
  if (!Number.isFinite(end) || end <= start) return 95;
  const ratio = (now - start) / (end - start);
  return Math.max(4, Math.min(95, Math.round(ratio * 100)));
}

async function getBrainProgress(brandId: string) {
  const admin = createAdminClient();

  const [kbResult, syncedResult, entitlementResult] = await Promise.all([
    admin
      .from("knowledge_bases")
      .select("status")
      .eq("brand_id", brandId)
      .maybeSingle(),
    admin
      .from("knowledge_files")
      .select("id")
      .eq("brand_id", brandId)
      .eq("rag_status", "RAG_SYNCED"),
    admin
      .from("agent_entitlements")
      .select("id")
      .eq("brand_id", brandId)
      .eq("status", "ACTIVE"),
  ]);

  if (kbResult.error) throw kbResult.error;
  if (syncedResult.error) throw syncedResult.error;
  if (entitlementResult.error) throw entitlementResult.error;

  const kb = kbResult.data as KnowledgeBaseRow | null;
  const syncedFiles = ((syncedResult.data ?? []) as KnowledgeFileRow[]).length;
  const activeAgents =
    ((entitlementResult.data ?? []) as AgentEntitlementRow[]).length;

  const kbCreated = Boolean(kb);
  const filesSynced = syncedFiles > 0;
  const brainReady = kb?.status === "RAG_SYNCED" && filesSynced;
  const agentsActive = activeAgents > 0;

  const checks = [kbCreated, filesSynced, brainReady, agentsActive];
  const done = checks.filter(Boolean).length;
  const total = checks.length;
  const percent = Math.round((done / total) * 100);

  let status: PhaseStatus = "locked";
  if (done === total) status = "complete";
  else if (done > 0) status = "active";

  const substeps: SubstepProgress[] = [
    {
      id: "corpus",
      title: "Corpus Assembly",
      description: "Curate the canonical brand corpus.",
      progress: kbCreated ? 100 : 0,
      state: kbCreated ? "done" : "locked",
    },
    {
      id: "sync",
      title: "Knowledge Sync",
      description: "Chunk, embed, and store brand knowledge.",
      progress: filesSynced ? 100 : 0,
      state: filesSynced ? "done" : kbCreated ? "in-progress" : "locked",
    },
    {
      id: "brain",
      title: "Brain Activation",
      description: "Deploy the brand-aware brain on workspace.",
      progress: brainReady ? 100 : 0,
      state: brainReady ? "done" : filesSynced ? "in-progress" : "locked",
    },
    {
      id: "agents",
      title: "Agent Deployment",
      description: "Activate specialist agents for brand operations.",
      progress: agentsActive ? 100 : 0,
      state: agentsActive ? "done" : brainReady ? "in-progress" : "locked",
    },
  ];

  return { percent, status, stepsDone: done, stepsTotal: total, substeps };
}

function aestheticsSubstepState(
  status: AestheticsDeliverableStatus | null,
): { state: SubstepState; progress: number } {
  switch (status) {
    case "APPROVED":
      return { state: "done", progress: 100 };
    case "CLIENT_REVIEW":
      return { state: "awaiting-review", progress: 50 };
    case "CHANGES_REQUESTED":
      return { state: "in-progress", progress: 50 };
    default:
      // PENDING_UPLOAD or no row yet — team is preparing it.
      return { state: "in-progress", progress: 0 };
  }
}

async function getAestheticsProgressFromDB(brandId: string): Promise<{
  percent: number;
  status: PhaseStatus;
  stepsDone: number;
  stepsTotal: number;
  substeps: SubstepProgress[];
}> {
  const rows = await getAestheticsRowsByBrand(brandId).catch(() => []);
  const statusByKind = new Map(
    rows.map((row) => [
      row.kind as AestheticsKind,
      row.status as AestheticsDeliverableStatus,
    ]),
  );

  const kindDefs: Array<{
    kind: AestheticsKind;
    id: string;
    title: string;
    description: string;
  }> = [
    {
      kind: "VISUAL_DIRECTION",
      id: "visual-direction",
      title: "Visual Direction",
      description: "Define the brand's visual aesthetic direction.",
    },
    {
      kind: "COLOR_TYPE_SYSTEM",
      id: "color-type-system",
      title: "Color & Type System",
      description: "Establish the brand color palette and typography.",
    },
    {
      kind: "ASSET_LIBRARY",
      id: "asset-library",
      title: "Asset Library",
      description: "Curate the brand's core visual assets.",
    },
  ];

  const substeps: SubstepProgress[] = kindDefs.map(
    ({ kind, id, title, description }) => {
      const { state, progress } = aestheticsSubstepState(
        statusByKind.get(kind) ?? null,
      );
      return {
        id,
        title,
        description,
        progress,
        state,
        href: aestheticsDeliverablePath(aestheticsKindSlugs[kind]),
      };
    },
  );

  const stepsDone = substeps.filter((s) => s.state === "done").length;
  const stepsTotal = substeps.length;
  const allDone = stepsDone === stepsTotal;
  const anyProgress = substeps.some(
    (s) => s.state !== "locked" && s.state !== "done",
  );

  const status: PhaseStatus = allDone
    ? "complete"
    : anyProgress || stepsDone > 0
      ? "active"
      : "active"; // always active once strategies are complete

  const percent =
    stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;

  return { percent, status, stepsDone, stepsTotal, substeps };
}

function getAestheticsLockedStub(): {
  percent: number;
  status: PhaseStatus;
  stepsDone: number;
  stepsTotal: number;
  substeps: SubstepProgress[];
} {
  const substeps: SubstepProgress[] = [
    {
      id: "visual-direction",
      title: "Visual Direction",
      description: "Define the brand's visual aesthetic direction.",
      progress: 0,
      state: "locked",
    },
    {
      id: "color-type-system",
      title: "Color & Type System",
      description: "Establish the brand color palette and typography.",
      progress: 0,
      state: "locked",
    },
    {
      id: "asset-library",
      title: "Asset Library",
      description: "Curate the brand's core visual assets.",
      progress: 0,
      state: "locked",
    },
  ];

  return {
    percent: 0,
    status: "locked" as PhaseStatus,
    stepsDone: 0,
    stepsTotal: substeps.length,
    substeps,
  };
}

export async function getBrandBuildProgress(
  brandId: string,
  brandName: string,
  options: {
    intakeData?: IntakePageData | null | Promise<IntakePageData | null>;
  } = {},
): Promise<BrandBuildProgress> {
  const [stakeholderStatus, futuresResearchStatus] = await Promise.all([
    getStakeholderStatusSafe(brandId),
    getFuturesResearchStatusSafe(brandId),
  ]);
  const intakeProgressPromise =
    "intakeData" in options
      ? Promise.resolve(options.intakeData).then((intakeData) =>
          intakeData
            ? getIntakeProgressFromPageData(
                intakeData,
                stakeholderStatus,
                futuresResearchStatus,
              )
            : getIntakeProgress(
                brandId,
                stakeholderStatus,
                futuresResearchStatus,
              ),
        )
      : getIntakeProgress(brandId, stakeholderStatus, futuresResearchStatus);
  const [intake, brain, brainSchedule] = await Promise.all([
    intakeProgressPromise,
    getBrainProgress(brandId),
    getBrainBuildScheduleForBrand(brandId),
  ]);

  // Phase 2 (Strategies) is the brand-as-city City Model. It unlocks once the
  // questionnaire is captured, and its progress is the share of the city's
  // districts that have been approved.
  const questionnaireDone = intake.substeps.some(
    (substep) => substep.id === "questionnaires" && substep.state === "done",
  );
  const cityModelTotal = CITY_MODEL_DISTRICTS.length;
  const cityModelApproved = questionnaireDone
    ? await getApprovedCityModelDistrictCount(brandId)
    : 0;
  const cityModelPercent =
    cityModelTotal > 0
      ? Math.round((cityModelApproved / cityModelTotal) * 100)
      : 0;
  const cityModelComplete =
    questionnaireDone && cityModelApproved >= cityModelTotal;
  const cityModelSubstep: SubstepProgress = {
    id: "city-model",
    title: "City Model",
    description: "Open the brand-as-city districts to review and approve.",
    progress: cityModelPercent,
    state: !questionnaireDone
      ? "locked"
      : cityModelComplete
        ? "done"
        : "in-progress",
    href: ROUTES.brainRoadmapCityModel,
  };
  const strategies = {
    percent: cityModelPercent,
    status: (!questionnaireDone
      ? "locked"
      : cityModelComplete
        ? "complete"
        : "active") as PhaseStatus,
    stepsDone: cityModelApproved,
    stepsTotal: cityModelTotal,
    substeps: [cityModelSubstep],
  };

  // Phase 3 (Aesthetics) unlocks when all City Model districts are approved.
  // All three sub-steps (Visual Direction, Color & Type, Asset Library) unlock
  // simultaneously and are reviewed independently.
  const aesthetics = cityModelComplete
    ? await getAestheticsProgressFromDB(brandId)
    : getAestheticsLockedStub();

  const brainBuilt = Boolean(brainSchedule?.builtAt);

  if (brainBuilt) {
    // Bextudio has shipped the brain (built_at stamped by "Build Now"). That is
    // the single source of truth for "Phase 04 is done" — so the card jumps
    // straight to 100% / all sub-steps complete in one shot, regardless of the
    // finer-grained RAG checks. This keeps the roadmap from getting stuck at
    // "3 / 4" when, say, the agent-entitlement row didn't materialize but the
    // brain is demonstrably live.
    brain.status = "complete";
    brain.percent = 100;
    brain.stepsDone = brain.stepsTotal;
    brain.substeps = brain.substeps.map((substep) => ({
      ...substep,
      state: "done",
      progress: 100,
    }));
  } else if (aesthetics.status !== "complete") {
    brain.status = brain.stepsDone > 0 ? "active" : "locked";
  } else if (brain.status !== "complete") {
    // Aesthetics are approved, so Phase 04 is handed to Bextudio. Until the
    // brain ships it reads as "active" (in build), and — once a target date is
    // scheduled — its headline percent mirrors the cosmetic schedule bar so the
    // phase card and the in-panel progress agree.
    brain.status = "active";
    if (brainSchedule) {
      brain.percent = scheduleProgressPercent(brainSchedule.targetDate, brainSchedule.createdAt);
    }
  }

  const phase1: PhaseProgress = {
    phase: 1,
    key: "questionnaires",
    title: "Brand Research",
    description:
      "Gather the raw signal - questionnaires, stakeholder interviews and futures research - straight from the brand.",
    iconKind: "clipboard",
    status: intake.status,
    percent: intake.percent,
    stepsDone: intake.stepsDone,
    stepsTotal: intake.stepsTotal,
    substeps: intake.substeps,
  };

  const phase2: PhaseProgress = {
    phase: 2,
    key: "strategies",
    title: "Strategies",
    description:
      "Synthesize the inputs into a working brand strategy the brain can reason from.",
    iconKind: "spark",
    status: strategies.status,
    percent: strategies.percent,
    stepsDone: strategies.stepsDone,
    stepsTotal: strategies.stepsTotal,
    substeps: strategies.substeps,
  };

  const phase3: PhaseProgress = {
    phase: 3,
    key: "aesthetics",
    title: "Aesthetics",
    description:
      "Shape the brand's visual language - direction, system and assets - before the brain ships.",
    iconKind: "palette",
    status: aesthetics.status,
    percent: aesthetics.percent,
    stepsDone: aesthetics.stepsDone,
    stepsTotal: aesthetics.stepsTotal,
    substeps: aesthetics.substeps,
  };

  const phase4: PhaseProgress = {
    phase: 4,
    key: "brain_build",
    title: "Brain Build",
    description:
      "Assemble, train and ship the brand-aware model - locked until aesthetics lands.",
    iconKind: "chip",
    status: brain.status,
    percent: brain.percent,
    stepsDone: brain.stepsDone,
    stepsTotal: brain.stepsTotal,
    substeps: brain.substeps,
  };

  const phases: [
    PhaseProgress,
    PhaseProgress,
    PhaseProgress,
    PhaseProgress,
  ] = [phase1, phase2, phase3, phase4];
  const totalSteps =
    phase1.stepsTotal +
    phase2.stepsTotal +
    phase3.stepsTotal +
    phase4.stepsTotal;
  const doneSteps =
    phase1.stepsDone + phase2.stepsDone + phase3.stepsDone + phase4.stepsDone;
  const overallPercent =
    totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const activePhase =
    phases.find((phase) => phase.status === "active") ??
    phases.find((phase) => phase.status === "locked") ??
    null;

  return {
    brandId,
    brandName,
    overallPercent,
    stepsDone: doneSteps,
    stepsTotal: totalSteps,
    activePhase,
    phases,
    brainBuild: brainSchedule
      ? {
          targetDate: brainSchedule.targetDate,
          scheduledAt: brainSchedule.createdAt,
          builtAt: brainSchedule.builtAt,
        }
      : null,
  };
}
