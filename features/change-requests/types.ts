import type { IntakeQuestion, IntakeSectionWithQuestions } from "@/features/intake/types";

export const changeRequestStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "APPLIED",
  "CLOSED",
] as const;

export type ChangeRequestStatus = (typeof changeRequestStatuses)[number];

export const changeRequestTargetTypes = [
  "INTAKE_SECTION",
  "INTAKE_QUESTION",
  "MODULE",
] as const;

export type ChangeRequestTargetType = (typeof changeRequestTargetTypes)[number];

export type ChangeRequestModuleOption = {
  id: string;
  title: string;
  moduleType: string;
  status: string;
};

export type ChangeRequestCreateOptions = {
  brandId: string;
  brandName: string;
  membershipRole: "OWNER" | "EXECUTIVE_MANAGER";
  intakeLocked: boolean;
  sections: IntakeSectionWithQuestions[];
  modules: ChangeRequestModuleOption[];
};

export type CreateChangeRequestInput = {
  targetType: ChangeRequestTargetType;
  sectionKey: string | null;
  questionId: string | null;
  moduleId: string | null;
  reason: string;
  comment: string;
};

export type CreateChangeRequestFormState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
      requestId: string;
    };

export type ChangeRequestRecord = {
  id: string;
  brandId: string;
  targetType: ChangeRequestTargetType;
  targetId: string | null;
  sectionKey: string | null;
  questionId: string | null;
  requestedBy: string | null;
  reason: string | null;
  comment: string;
  status: ChangeRequestStatus;
  reviewedBy: string | null;
  resolutionNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreatedChangeRequestResult = {
  request: ChangeRequestRecord;
  auditAction: "change_request_created" | "module_change_requested";
};

export type ChangeRequestReviewItem = ChangeRequestRecord & {
  brandName: string;
  requesterEmail: string | null;
  reviewerEmail: string | null;
  targetLabel: string;
};

export type ReviewChangeRequestInput = {
  requestId: string;
  status: ChangeRequestStatus;
  resolutionNote: string | null;
};

export type ReviewChangeRequestFormState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
      requestId: string;
      requestStatus: ChangeRequestStatus;
    };

export type ChangeRequestTargetContext = {
  intakeLocked: boolean;
  sections: IntakeSectionWithQuestions[];
  modules: ChangeRequestModuleOption[];
};

export type ChangeRequestQuestionOption = IntakeQuestion & {
  sectionKey: string;
  sectionTitle: string;
};
