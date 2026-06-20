import "server-only";

import { cache } from "react";

import { isActiveBrandEntitlement } from "@/features/access/access-summary";
import type { BrandAccessEntitlement } from "@/features/access/types";
import {
  canAnswerIntakeRole,
  calculateIntakeCompletion,
  extractStoredAnswerValue,
} from "@/features/questionnaire/schemas";
import type {
  IntakeAccessContext,
  IntakeAnswerMap,
  IntakePageData,
  IntakeQuestion,
  IntakeSection,
  IntakeSectionWithQuestions,
  IntakeSession,
  IntakeSnapshotJson,
  IntakeSubmissionSummary,
} from "@/features/questionnaire/types";
import { cacheSharedConfig } from "@/lib/cache/shared";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { createAdminClient } from "@/lib/supabase/admin";

type RelatedRecord<T> = T | T[] | null;

type BrandRow = {
  id: string;
  name: string;
};

type PlanRow = {
  name: string | null;
  credits: number | null;
};

type MembershipRow = {
  brand_id: string;
  role: string;
  brands: RelatedRecord<BrandRow>;
};

type EntitlementRow = {
  brand_id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  plans: RelatedRecord<PlanRow>;
};

type IntakeSessionRow = {
  id: string;
  brand_id: string;
  status: string;
  completion_percent: number | null;
  locked_at: string | null;
  locked_by: string | null;
};

type SectionRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  order_index: number;
  is_required: boolean | null;
};

type QuestionRow = {
  id: string;
  section_id: string;
  key: string;
  question_text: string;
  help_text: string | null;
  input_type: string;
  is_required: boolean | null;
  order_index: number;
  validation_schema: unknown;
};

type AnswerRow = {
  id: string;
  session_id: string;
  question_id: string;
  value: unknown;
  updated_by: string | null;
};

function isMissingIntakeActiveColumnError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; message?: unknown };
  const message = typeof record.message === "string" ? record.message : "";

  return record.code === "42703" && message.includes("is_active");
}

function firstRelated<T>(record: RelatedRecord<T>) {
  return Array.isArray(record) ? (record[0] ?? null) : record;
}

function toIntakeSession(row: IntakeSessionRow): IntakeSession {
  return {
    id: row.id,
    brandId: row.brand_id,
    status: row.status,
    completionPercent: row.completion_percent ?? 0,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
  };
}

function toIntakeSection(row: SectionRow): IntakeSection {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    description: row.description,
    orderIndex: row.order_index,
    isRequired: row.is_required ?? true,
  };
}

function toIntakeQuestion(row: QuestionRow): IntakeQuestion {
  return {
    id: row.id,
    sectionId: row.section_id,
    key: row.key,
    questionText: row.question_text,
    helpText: row.help_text,
    inputType: row.input_type,
    isRequired: row.is_required ?? true,
    orderIndex: row.order_index,
    validationSchema: row.validation_schema,
  };
}

export const getIntakeAccessForProfile = cache(async function getIntakeAccessForProfile({
  profileId,
  brandId,
}: {
  profileId: string;
  brandId?: string;
}): Promise<IntakeAccessContext | null> {
  const admin = createAdminClient();

  const { data: profileData } = await admin
    .from("users_profile")
    .select("global_role")
    .eq("id", profileId)
    .maybeSingle();

  const isPlatformOwner =
    (profileData as { global_role: string } | null)?.global_role ===
    "PLATFORM_OWNER";

  // Resolve the brand from the user's OWN active OWNER/EXECUTIVE_MANAGER
  // membership FIRST. "Their" brand always takes precedence over the platform
  // owner fallback below — otherwise a Platform Owner who also belongs to a
  // brand resolves onto whatever brand happens to be first in the table, leaking
  // their questionnaire / change requests onto an unrelated brand's data.
  let membershipQuery = admin
    .from("brand_memberships")
    .select("brand_id, role, brands(id, name)")
    .eq("user_id", profileId)
    .eq("status", "ACTIVE")
    .in("role", ["OWNER", "EXECUTIVE_MANAGER"]);

  if (brandId) {
    membershipQuery = membershipQuery.eq("brand_id", brandId);
  }

  const { data: membershipData, error: membershipError } =
    await membershipQuery;

  if (membershipError) {
    throw membershipError;
  }

  const memberships = ((membershipData ?? []) as MembershipRow[])
    .map((membership) => {
      const brand = firstRelated(membership.brands);

      if (!brand || !canAnswerIntakeRole(membership.role)) {
        return null;
      }

      return {
        brandId: membership.brand_id,
        brandName: brand.name,
        membershipRole: membership.role as "OWNER" | "EXECUTIVE_MANAGER",
      };
    })
    .filter(
      (membership): membership is NonNullable<typeof membership> =>
        Boolean(membership),
    );

  if (memberships.length > 0) {
    const brandIds = memberships.map((membership) => membership.brandId);
    const { data: entitlementData, error: entitlementError } = await admin
      .from("brand_entitlements")
      .select("brand_id, status, starts_at, expires_at, plans(name, credits)")
      .in("brand_id", brandIds)
      .eq("status", "ACTIVE");

    if (entitlementError) {
      throw entitlementError;
    }

    const entitlements = ((entitlementData ?? []) as EntitlementRow[]).map(
      (entitlement): BrandAccessEntitlement => {
        const plan = firstRelated(entitlement.plans);

        return {
          brandId: entitlement.brand_id,
          status: entitlement.status,
          startsAt: entitlement.starts_at,
          expiresAt: entitlement.expires_at,
          planName: plan?.name ?? null,
          credits: plan?.credits ?? 0,
        };
      },
    );

    for (const membership of memberships) {
      const entitlement = entitlements.find(
        (item) =>
          item.brandId === membership.brandId && isActiveBrandEntitlement(item),
      );

      if (entitlement) {
        return {
          ...membership,
          planName: entitlement.planName,
        };
      }

      if (isPlatformOwner) {
        return {
          ...membership,
          planName: null,
        };
      }
    }
  }

  // Platform-owner fallback: only reached when the owner has no usable brand
  // membership of their own. Lets them open a brand for admin/preview — an
  // explicit brandId when provided, otherwise the first brand.
  if (isPlatformOwner) {
    let brandQuery = admin.from("brands").select("id, name").limit(1);
    if (brandId) {
      brandQuery = brandQuery.eq("id", brandId);
    }
    const { data: brandData } = await brandQuery.maybeSingle();
    const brand = brandData as { id: string; name: string } | null;
    if (brand) {
      const { data: entData } = await admin
        .from("brand_entitlements")
        .select("plans(name)")
        .eq("brand_id", brand.id)
        .eq("status", "ACTIVE")
        .limit(1)
        .maybeSingle();
      const plan = entData
        ? firstRelated((entData as { plans: RelatedRecord<PlanRow> }).plans)
        : null;
      return {
        brandId: brand.id,
        brandName: brand.name,
        membershipRole: "OWNER",
        planName: plan?.name ?? null,
      };
    }
  }

  return null;
});

export async function getLatestIntakeSessionForBrand(brandId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_sessions")
    .select("id, brand_id, status, completion_percent, locked_at, locked_by")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? toIntakeSession(data as unknown as IntakeSessionRow) : null;
}

async function loadIntakeSectionsWithQuestions() {
  const admin = createAdminClient();
  const loadSectionsAndQuestions = (activeOnly: boolean) => {
    let sectionsQuery = admin
      .from("question_sections")
      .select("id, key, title, description, order_index, is_required");
    let questionsQuery = admin
      .from("questions")
      .select(
        "id, section_id, key, question_text, help_text, input_type, is_required, order_index, validation_schema",
      );

    if (activeOnly) {
      sectionsQuery = sectionsQuery.eq("is_active", true);
      questionsQuery = questionsQuery.eq("is_active", true);
    }

    return Promise.all([
      sectionsQuery.order("order_index", { ascending: true }),
      questionsQuery
        .order("section_id", { ascending: true })
        .order("order_index", { ascending: true }),
    ]);
  };

  let [sectionsResult, questionsResult] =
    await loadSectionsAndQuestions(true);

  if (
    isMissingIntakeActiveColumnError(sectionsResult.error) ||
    isMissingIntakeActiveColumnError(questionsResult.error)
  ) {
    [sectionsResult, questionsResult] = await loadSectionsAndQuestions(false);
  }

  if (sectionsResult.error) {
    throw sectionsResult.error;
  }

  if (questionsResult.error) {
    throw questionsResult.error;
  }

  const questions = ((questionsResult.data ?? []) as QuestionRow[]).map(
    toIntakeQuestion,
  );

  return ((sectionsResult.data ?? []) as SectionRow[]).map(
    (section): IntakeSectionWithQuestions => {
      const intakeSection = toIntakeSection(section);

      return {
        ...intakeSection,
        questions: questions.filter(
          (question) => question.sectionId === intakeSection.id,
        ),
      };
    },
  );
}

const getCachedIntakeSectionsWithQuestions = cacheSharedConfig(
  loadIntakeSectionsWithQuestions,
  ["intake-sections-with-questions"],
  {
    revalidate: 3600,
    tags: [CACHE_TAGS.intakeConfig],
  },
);

export async function getIntakeSectionsWithQuestions() {
  return getCachedIntakeSectionsWithQuestions();
}

export async function getIntakeAnswersForSession({
  sessionId,
  questions,
}: {
  sessionId: string;
  questions: IntakeQuestion[];
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_answers")
    .select("id, session_id, question_id, value, updated_by")
    .eq("session_id", sessionId);

  if (error) {
    throw error;
  }

  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );

  return ((data ?? []) as AnswerRow[]).reduce<IntakeAnswerMap>(
    (answers, answer) => {
      const question = questionById.get(answer.question_id);

      if (!question) {
        return answers;
      }

      return {
        ...answers,
        [answer.question_id]: extractStoredAnswerValue({
          inputType: question.inputType,
          storedValue: answer.value,
        }),
      };
    },
    {},
  );
}

export async function getIntakePageData({
  profileId,
}: {
  profileId: string;
}): Promise<IntakePageData | null> {
  const access = await getIntakeAccessForProfile({ profileId });

  if (!access) {
    return null;
  }

  const { ensureIntakeSessionForBrand } = await import(
    "@/features/questionnaire/services"
  );
  const [session, sections] = await Promise.all([
    ensureIntakeSessionForBrand(access.brandId),
    getIntakeSectionsWithQuestions(),
  ]);
  const questions = sections.flatMap((section) => section.questions);
  const answers = await getIntakeAnswersForSession({
    sessionId: session.id,
    questions,
  });
  const latestSnapshotId =
    session.status === "LOCKED"
      ? await getLatestIntakeSnapshotId(session.id)
      : null;

  return {
    access,
    session,
    sections,
    answers,
    completion: calculateIntakeCompletion({ sections, answers }),
    latestSnapshotId,
  };
}

// Most recent snapshot for a session (the questionnaire locks once, but order
// defensively in case of re-locks).
export async function getLatestIntakeSnapshotId(
  sessionId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_snapshots")
    .select("id")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as { id: string } | null)?.id ?? null;
}

// Loads a snapshot's answers for download, authorizing the caller: platform
// owners and active brand Owners/Executive Managers of the snapshot's brand.
export async function getIntakeSnapshotForProfile({
  profileId,
  snapshotId,
}: {
  profileId: string;
  snapshotId: string;
}): Promise<{ snapshotJson: IntakeSnapshotJson; brandName: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_snapshots")
    .select("id, brand_id, snapshot_json")
    .eq("id", snapshotId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const snapshot = data as
    | { id: string; brand_id: string; snapshot_json: IntakeSnapshotJson }
    | null;
  if (!snapshot) {
    return null;
  }

  const access = await getIntakeAccessForProfile({
    profileId,
    brandId: snapshot.brand_id,
  });
  if (!access) {
    return null;
  }

  return { snapshotJson: snapshot.snapshot_json, brandName: access.brandName };
}

// Admin Submissions list: every locked questionnaire, newest first.
export async function getIntakeSubmissionsForAdmin(): Promise<
  IntakeSubmissionSummary[]
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("intake_snapshots")
    .select("id, brand_id, created_at, brands(name)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      id: string;
      brand_id: string;
      created_at: string | null;
      brands: RelatedRecord<{ name: string }>;
    }>
  ).map((row) => ({
    snapshotId: row.id,
    brandId: row.brand_id,
    brandName: firstRelated(row.brands)?.name ?? "Unknown brand",
    submittedAt: row.created_at,
  }));
}
