import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type PhaseStatus = "locked" | "active" | "complete";

export type PhaseProgress = {
  phase: 1 | 2 | 3;
  key: "questionnaires" | "strategies" | "brain_build";
  title: string;
  description: string;
  teamLabel: string;
  status: PhaseStatus;
  percent: number;
  stepsDone: number;
  stepsTotal: number;
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

type ModuleRow = {
  id: string;
  status: string;
};

type KnowledgeBaseRow = {
  status: string | null;
};

type KnowledgeFileRow = {
  id: string;
};

type AgentEntitlementRow = {
  id: string;
  status: string;
};

async function getIntakeProgress(brandId: string) {
  const admin = createAdminClient();

  const [sessionResult, questionCountResult] = await Promise.all([
    admin
      .from("intake_sessions")
      .select("completion_percent, status")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("questions")
      .select("id"),
  ]);

  if (sessionResult.error) throw sessionResult.error;
  if (questionCountResult.error) throw questionCountResult.error;

  const session = sessionResult.data as IntakeRow | null;
  const totalQuestions = ((questionCountResult.data ?? []) as { id: string }[]).length;
  const percent = session?.completion_percent ?? 0;
  const answeredQuestions = Math.round((percent / 100) * totalQuestions);

  let status: PhaseStatus = "locked";
  if (session?.status === "LOCKED") {
    status = "complete";
  } else if (percent > 0) {
    status = "active";
  } else if (session) {
    status = "active";
  }

  return { percent, status, stepsDone: answeredQuestions, stepsTotal: totalQuestions };
}

async function getModulesProgress(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("brand_modules")
    .select("id, status")
    .eq("brand_id", brandId);

  if (error) throw error;

  const modules = (data ?? []) as ModuleRow[];
  const total = modules.length;

  if (total === 0) {
    return { percent: 0, status: "locked" as PhaseStatus, stepsDone: 0, stepsTotal: 0 };
  }

  const approved = modules.filter((m) =>
    MODULE_APPROVED_STATUSES.includes(m.status),
  ).length;
  const percent = Math.round((approved / total) * 100);

  let status: PhaseStatus = "locked";
  if (approved === total) {
    status = "complete";
  } else if (approved > 0 || modules.some((m) => m.status !== "NOT_STARTED")) {
    status = "active";
  }

  return { percent, status, stepsDone: approved, stepsTotal: total };
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
      .select("id, status")
      .eq("brand_id", brandId)
      .eq("status", "ACTIVE"),
  ]);

  if (kbResult.error) throw kbResult.error;
  if (syncedResult.error) throw syncedResult.error;
  if (entitlementResult.error) throw entitlementResult.error;

  const kb = kbResult.data as KnowledgeBaseRow | null;
  const syncedFiles = ((syncedResult.data ?? []) as KnowledgeFileRow[]).length;
  const activeAgents = ((entitlementResult.data ?? []) as AgentEntitlementRow[]).length;

  const kbCreated = Boolean(kb);
  const filesSynced = syncedFiles > 0;
  const brainReady = kb?.status === "RAG_SYNCED" && filesSynced;
  const agentsActive = activeAgents > 0;

  const substeps = [kbCreated, filesSynced, brainReady, agentsActive];
  const done = substeps.filter(Boolean).length;
  const total = substeps.length;
  const percent = Math.round((done / total) * 100);

  let status: PhaseStatus = "locked";
  if (done === total) {
    status = "complete";
  } else if (done > 0) {
    status = "active";
  }

  return { percent, status, stepsDone: done, stepsTotal: total };
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

  if (intake.status !== "complete" && modules.status !== "locked") {
    modules.status = modules.stepsDone > 0 ? "active" : "locked";
  }
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
    description: "Capture the raw signal — voice, audience, identity — direct from the brand.",
    teamLabel: "Completed by the Brand Marketing Team",
    status: intake.status,
    percent: intake.percent,
    stepsDone: intake.stepsDone,
    stepsTotal: intake.stepsTotal,
  };

  const phase2: PhaseProgress = {
    phase: 2,
    key: "strategies",
    title: "Strategies",
    description: "Synthesize the inputs into a working brand strategy the brain can reason from.",
    teamLabel: "Drafted by the Backstudio Strategy Team",
    status: modules.status,
    percent: modules.percent,
    stepsDone: modules.stepsDone,
    stepsTotal: modules.stepsTotal,
  };

  const phase3: PhaseProgress = {
    phase: 3,
    key: "brain_build",
    title: "Brain Build",
    description: "Assemble, train and ship the brand-aware model — locked until strategy lands.",
    teamLabel: "Engineered by the Backstudio AI Team",
    status: brain.status,
    percent: brain.percent,
    stepsDone: brain.stepsDone,
    stepsTotal: brain.stepsTotal,
  };

  const phases: [PhaseProgress, PhaseProgress, PhaseProgress] = [phase1, phase2, phase3];
  const totalSteps = phase1.stepsTotal + phase2.stepsTotal + phase3.stepsTotal;
  const doneSteps = phase1.stepsDone + phase2.stepsDone + phase3.stepsDone;
  const overallPercent = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const activePhase = phases.find((p) => p.status === "active") ?? phases.find((p) => p.status === "locked") ?? null;

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
