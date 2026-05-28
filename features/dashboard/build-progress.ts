import "server-only";

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
};

export type PhaseProgress = {
  phase: 1 | 2 | 3;
  key: "questionnaires" | "strategies" | "brain_build";
  title: string;
  description: string;
  team: string;
  teamVerb: string;
  iconKind: "clipboard" | "spark" | "chip";
  status: PhaseStatus;
  percent: number;
  stepsDone: number;
  stepsTotal: number;
  substeps: SubstepProgress[];
};

export type BrandBuildProgress = {
  brandId: string;
  brandName: string;
  overallPercent: number;
  stepsDone: number;
  stepsTotal: number;
  activePhase: PhaseProgress | null;
  phases: [PhaseProgress, PhaseProgress, PhaseProgress];
};

const MODULE_APPROVED_STATUSES = [
  "CLIENT_APPROVED",
  "RAG_REVIEW_REQUIRED",
  "RAG_APPROVED",
  "RAG_SYNCED",
  "LOCKED",
];

type IntakeRow = {
  completion_percent: number | null;
  status: string;
};

type SectionRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
};

type QuestionRow = {
  id: string;
  section_id: string;
};

type AnswerRow = {
  question_id: string;
};

type ModuleRow = {
  id: string;
  title: string;
  module_type: string;
  status: string;
};

type KnowledgeBaseRow = {
  status: string | null;
};

type KnowledgeFileRow = { id: string };
type AgentEntitlementRow = { id: string };

function mapModuleState(status: string): SubstepState {
  if (MODULE_APPROVED_STATUSES.includes(status)) return "done";
  if (status === "CLIENT_REVIEW") return "awaiting-review";
  if (status === "CLIENT_CHANGE_REQUESTED") return "in-progress";
  if (status === "IN_PROGRESS" || status === "ASSIGNED" || status === "INTERNAL_REVIEW" || status === "SUPERVISOR_APPROVED") return "in-progress";
  return "locked";
}

async function getIntakeProgress(brandId: string) {
  const admin = createAdminClient();

  const [sessionResult, sectionsResult, questionsResult, answersResult] =
    await Promise.all([
      admin
        .from("intake_sessions")
        .select("completion_percent, status")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("question_sections")
        .select("id, key, title, description")
        .order("order_index", { ascending: true }),
      admin.from("questions").select("id, section_id"),
      admin
        .from("intake_answers")
        .select("question_id")
        .eq(
          "session_id",
          (
            await admin
              .from("intake_sessions")
              .select("id")
              .eq("brand_id", brandId)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle()
          ).data?.id ?? "00000000-0000-0000-0000-000000000000",
        ),
    ]);

  if (sessionResult.error) throw sessionResult.error;
  if (sectionsResult.error) throw sectionsResult.error;
  if (questionsResult.error) throw questionsResult.error;

  const session = sessionResult.data as IntakeRow | null;
  const sections = (sectionsResult.data ?? []) as SectionRow[];
  const questions = (questionsResult.data ?? []) as QuestionRow[];
  const answeredIds = new Set(
    ((answersResult.data ?? []) as AnswerRow[]).map((a) => a.question_id),
  );
  const isLocked = session?.status === "LOCKED";

  const substeps: SubstepProgress[] = sections.map((section) => {
    const sectionQuestions = questions.filter(
      (q) => q.section_id === section.id,
    );
    const answered = sectionQuestions.filter((q) =>
      answeredIds.has(q.id),
    ).length;
    const total = sectionQuestions.length;
    const rawProgress = total > 0 ? Math.round((answered / total) * 100) : 0;
    // Once intake is locked (submitted), all sections are sealed at 100%
    const progress = isLocked ? 100 : rawProgress;

    let state: SubstepState = "locked";
    if (isLocked || progress === 100) state = "done";
    else if (progress > 0) state = "in-progress";
    else if (session) state = "in-progress";

    return {
      id: section.key,
      title: section.title,
      description: section.description ?? "",
      progress,
      state,
    };
  });

  const totalQuestions = questions.length;
  // When locked, force 100% (truth is "submitted") regardless of stale completion_percent
  const percent = isLocked ? 100 : session?.completion_percent ?? 0;
  const answeredCount = isLocked ? totalQuestions : answeredIds.size;

  let status: PhaseStatus = "locked";
  if (isLocked) status = "complete";
  else if (percent > 0 || session) status = "active";

  return {
    percent,
    status,
    stepsDone: answeredCount,
    stepsTotal: totalQuestions,
    substeps,
  };
}

async function getModulesProgress(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_modules")
    .select("id, title, module_type, status")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const modules = (data ?? []) as ModuleRow[];
  const total = modules.length;

  if (total === 0) {
    return {
      percent: 0,
      status: "locked" as PhaseStatus,
      stepsDone: 0,
      stepsTotal: 0,
      substeps: [] as SubstepProgress[],
    };
  }

  const approved = modules.filter((m) =>
    MODULE_APPROVED_STATUSES.includes(m.status),
  ).length;
  const percent = Math.round((approved / total) * 100);

  let status: PhaseStatus = "locked";
  if (approved === total) status = "complete";
  else if (approved > 0 || modules.some((m) => m.status !== "NOT_STARTED"))
    status = "active";

  const substeps: SubstepProgress[] = modules.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.module_type,
    progress: MODULE_APPROVED_STATUSES.includes(m.status) ? 100 : 0,
    state: mapModuleState(m.status),
  }));

  return { percent, status, stepsDone: approved, stepsTotal: total, substeps };
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

export async function getBrandBuildProgress(
  brandId: string,
  brandName: string,
): Promise<BrandBuildProgress> {
  const [intake, modules, brain] = await Promise.all([
    getIntakeProgress(brandId),
    getModulesProgress(brandId),
    getBrainProgress(brandId),
  ]);

  if (intake.status !== "complete") {
    modules.status = modules.stepsDone > 0 ? "active" : "locked";
  }
  if (modules.status !== "complete") {
    brain.status = brain.stepsDone > 0 ? "active" : "locked";
  }

  const phase1: PhaseProgress = {
    phase: 1,
    key: "questionnaires",
    title: "Questionnaires",
    description:
      "Capture the raw signal — voice, audience, identity — direct from the brand.",
    team: "Brand Marketing Team",
    teamVerb: "Completed",
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
    team: "Bextudio Strategy Team",
    teamVerb: "Drafted",
    iconKind: "spark",
    status: modules.status,
    percent: modules.percent,
    stepsDone: modules.stepsDone,
    stepsTotal: modules.stepsTotal,
    substeps: modules.substeps,
  };

  const phase3: PhaseProgress = {
    phase: 3,
    key: "brain_build",
    title: "Brain Build",
    description:
      "Assemble, train and ship the brand-aware model — locked until strategy lands.",
    team: "Bextudio AI Team",
    teamVerb: "Engineered",
    iconKind: "chip",
    status: brain.status,
    percent: brain.percent,
    stepsDone: brain.stepsDone,
    stepsTotal: brain.stepsTotal,
    substeps: brain.substeps,
  };

  const phases: [PhaseProgress, PhaseProgress, PhaseProgress] = [
    phase1,
    phase2,
    phase3,
  ];
  const totalSteps =
    phase1.stepsTotal + phase2.stepsTotal + phase3.stepsTotal;
  const doneSteps = phase1.stepsDone + phase2.stepsDone + phase3.stepsDone;
  const overallPercent =
    totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const activePhase =
    phases.find((p) => p.status === "active") ??
    phases.find((p) => p.status === "locked") ??
    null;

  return {
    brandId,
    brandName,
    overallPercent,
    stepsDone: doneSteps,
    stepsTotal: totalSteps,
    activePhase,
    phases,
  };
}
