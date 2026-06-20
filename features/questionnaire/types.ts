export type IntakeAnswerRole = "OWNER" | "EXECUTIVE_MANAGER";

export type IntakeAccessContext = {
  brandId: string;
  brandName: string;
  membershipRole: IntakeAnswerRole;
  planName: string | null;
};

export type IntakeSession = {
  id: string;
  brandId: string;
  status: string;
  completionPercent: number;
  lockedAt: string | null;
  lockedBy: string | null;
};

export type IntakeSection = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isRequired: boolean;
};

export type IntakeQuestion = {
  id: string;
  sectionId: string;
  key: string;
  questionText: string;
  helpText: string | null;
  inputType: string;
  isRequired: boolean;
  orderIndex: number;
  validationSchema: unknown;
};

export type IntakeSectionWithQuestions = IntakeSection & {
  questions: IntakeQuestion[];
};

export type IntakeAnswerValue = string | number | boolean | string[] | null;

export type IntakeAnswer = {
  id: string;
  sessionId: string;
  questionId: string;
  value: IntakeAnswerValue;
  updatedBy: string | null;
};

export type IntakeAnswerMap = Record<string, IntakeAnswerValue>;

export type IntakeQuestionOption = {
  label: string;
  value: string;
};

export type IntakeInputKind =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "multi_select";

export type IntakeSectionProgress = {
  sectionId: string;
  sectionKey: string;
  title: string;
  totalQuestions: number;
  answeredQuestions: number;
  completionPercent: number;
};

export type IntakeCompletion = {
  totalQuestions: number;
  answeredQuestions: number;
  completionPercent: number;
  sections: IntakeSectionProgress[];
};

export type IntakePageData = {
  access: IntakeAccessContext;
  session: IntakeSession;
  sections: IntakeSectionWithQuestions[];
  answers: IntakeAnswerMap;
  completion: IntakeCompletion;
  // Latest locked snapshot for this session, if any — drives the Word download.
  latestSnapshotId: string | null;
  // Question ids the user explicitly "Save & mark done"-ed. null when the
  // marked_done_at column isn't migrated yet (overview falls back to value-based).
  markedDoneQuestionIds: string[] | null;
};

export type IntakeSubmissionSummary = {
  snapshotId: string;
  brandId: string;
  brandName: string;
  submittedAt: string | null;
};

export type AutosaveIntakeAnswerInput = {
  sessionId: string;
  questionId: string;
  value: unknown;
};

export type AutosaveIntakeAnswersInput = {
  sessionId: string;
  answers: Array<{
    questionId: string;
    value: unknown;
  }>;
};

export type AutosaveIntakeAnswerResult =
  | {
      ok: true;
      questionId: string;
      value: IntakeAnswerValue;
      completionPercent: number;
    }
  | {
      ok: false;
      message: string;
    };

export type AutosaveIntakeAnswersResult =
  | {
      ok: true;
      answers: Array<{
        questionId: string;
        value: IntakeAnswerValue;
      }>;
      completionPercent: number;
    }
  | {
      ok: false;
      message: string;
      failedQuestionIds?: string[];
    };

export type FinalSubmitIntakeFormState =
  | {
      status: "idle";
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
      snapshotId: string;
    };

export type ReopenIntakeFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export type IntakeInternalNotificationPlaceholder = {
  status: "placeholder";
  channel: "internal_team";
  event: "intake_final_submitted";
  brandId: string;
  sessionId: string;
  snapshotId: string;
  createdAt: string;
  delivery: "not_configured";
};

export type IntakeSnapshotQuestion = {
  id: string;
  key: string;
  questionText: string;
  helpText: string | null;
  inputType: string;
  orderIndex: number;
  answer: {
    value: IntakeAnswerValue;
  };
};

export type IntakeSnapshotSection = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  orderIndex: number;
  questions: IntakeSnapshotQuestion[];
};

export type IntakeSnapshotJson = {
  version: 1;
  submittedAt: string;
  submittedBy: string;
  brand: {
    id: string;
    name: string;
    planName: string | null;
    membershipRole: IntakeAnswerRole;
  };
  session: {
    id: string;
    status: "LOCKED";
    lockedAt: string;
    lockedBy: string;
    completionPercent: number;
  };
  completion: IntakeCompletion;
  sections: IntakeSnapshotSection[];
};

export type FinalSubmitIntakeResult = {
  brandId: string;
  sessionId: string;
  snapshotId: string;
  lockedAt: string;
  completionPercent: number;
  sectionKeys: string[];
};
