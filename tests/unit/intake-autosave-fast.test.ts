import { beforeEach, describe, expect, it, vi } from "vitest";

const afterState = vi.hoisted(() => ({
  tasks: [] as Array<() => Promise<void> | void>,
}));

vi.mock("next/server", () => ({
  after: vi.fn((task: () => Promise<void> | void) => {
    afterState.tasks.push(task);
  }),
}));

vi.mock("@/lib/audit/logAudit", () => ({
  logAudit: vi.fn(),
}));

vi.mock("@/lib/logging/server", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/auth/profile", () => ({
  loadUserProfileByAuthUserId: vi.fn(),
}));

import {
  autosaveIntakeAnswer,
  autosaveIntakeAnswers,
} from "@/features/intake/services";
import { loadUserProfileByAuthUserId } from "@/features/auth/profile";
import { logAudit } from "@/lib/audit/logAudit";
import { logServerError } from "@/lib/logging/server";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedLoadUserProfileByAuthUserId = vi.mocked(loadUserProfileByAuthUserId);
const mockedLogAudit = vi.mocked(logAudit);
const mockedLogServerError = vi.mocked(logServerError);

function setupRpc(
  implementation: (rpcName: string, params: Record<string, unknown>) => unknown,
) {
  const rpc = vi.fn((rpcName: string, params: Record<string, unknown>) =>
    Promise.resolve(implementation(rpcName, params)),
  );

  mockedCreateAdminClient.mockReturnValue({ rpc } as never);

  return rpc;
}

function successRow(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    message: null,
    question_id: "question-1",
    answer_id: "answer-1",
    previous_value: null,
    value: { value: "Executive answer" },
    input_type: "textarea",
    brand_id: "brand-1",
    actor_profile_id: "profile-1",
    actor_role: "OWNER",
    completion_percent: 50,
    ...overrides,
  };
}

async function autosave(value: unknown = " Executive answer ") {
  return autosaveIntakeAnswer({
    input: {
      sessionId: "session-1",
      questionId: "question-1",
      value,
    },
    authUserId: "auth-user-1",
  });
}

async function autosaveBatch() {
  return autosaveIntakeAnswers({
    input: {
      sessionId: "session-1",
      answers: [
        { questionId: "question-1", value: " Executive answer " },
        { questionId: "question-2", value: ["voice", "market"] },
      ],
    },
    authUserId: "auth-user-1",
  });
}

describe("fast intake autosave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterState.tasks = [];
  });

  it("wraps single-answer saves through the batch autosave RPC", async () => {
    const rpc = setupRpc((rpcName) => {
      expect(rpcName).toBe("autosave_intake_answers_batch");
      return { data: [successRow()], error: null };
    });

    const result = await autosave();

    expect(rpc).toHaveBeenCalledWith("autosave_intake_answers_batch", {
      p_session_id: "session-1",
      p_auth_user_id: "auth-user-1",
      p_answers: [
        {
          question_id: "question-1",
          value: " Executive answer ",
        },
      ],
    });
    expect(result).toEqual({
      ok: true,
      questionId: "question-1",
      value: "Executive answer",
      completionPercent: 50,
    });
  });

  it("saves multiple answers through one batch RPC call", async () => {
    const rows = [
      successRow(),
      successRow({
        question_id: "question-2",
        answer_id: "answer-2",
        value: { value: ["market", "voice"] },
        input_type: "multi_select",
        completion_percent: 75,
      }),
    ];
    const rpc = setupRpc(() => ({ data: rows, error: null }));

    const result = await autosaveBatch();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: true,
      answers: [
        { questionId: "question-1", value: "Executive answer" },
        { questionId: "question-2", value: ["market", "voice"] },
      ],
      completionPercent: 75,
    });
  });

  it("schedules batch autosave audit after the save response", async () => {
    setupRpc(() => ({
      data: [
        successRow(),
        successRow({
          question_id: "question-2",
          answer_id: "answer-2",
          value: { value: ["market"] },
          input_type: "multi_select",
        }),
      ],
      error: null,
    }));

    const result = await autosaveBatch();

    expect(result.ok).toBe(true);
    expect(mockedLogAudit).not.toHaveBeenCalled();
    expect(afterState.tasks).toHaveLength(1);

    await afterState.tasks[0]();

    expect(mockedLogAudit).toHaveBeenCalledTimes(2);
    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "profile-1",
        actorRole: "OWNER",
        brandId: "brand-1",
        action: "intake_answer_updated",
        entityType: "intake_answer",
        entityId: "answer-1",
        before: null,
        after: expect.objectContaining({
          session_id: "session-1",
          question_id: "question-1",
          completion_percent: 50,
          answered: true,
        }),
      }),
    );
  });

  it("keeps save successful when best-effort audit fails later", async () => {
    setupRpc(() => ({ data: [successRow()], error: null }));
    mockedLogAudit.mockRejectedValueOnce(new Error("audit down"));

    const result = await autosave();

    expect(result.ok).toBe(true);

    await expect(afterState.tasks[0]()).resolves.toBeUndefined();
    expect(mockedLogServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "[intake] autosave audit failed",
      }),
    );
  });

  it.each([
    "This intake session is locked and cannot be edited.",
    "You do not have permission to answer this intake.",
    "The intake question could not be found.",
  ])("returns RPC validation errors without scheduling audit: %s", async (message) => {
    setupRpc(() => ({
      data: [
        {
          ok: false,
          message,
          question_id: null,
          answer_id: null,
          previous_value: null,
          value: null,
          input_type: null,
          brand_id: "brand-1",
          completion_percent: null,
        },
      ],
      error: null,
    }));

    await expect(autosaveBatch()).resolves.toEqual({
      ok: false,
      message,
      failedQuestionIds: ["question-1", "question-2"],
    });
    expect(afterState.tasks).toHaveLength(0);
  });

  it("logs batch RPC failures and returns the generic save error", async () => {
    setupRpc(() => ({
      data: null,
      error: { code: "PGRST500", message: "database unavailable" },
    }));

    await expect(autosaveBatch()).resolves.toEqual({
      ok: false,
      message: "The intake answer could not be saved.",
      failedQuestionIds: ["question-1", "question-2"],
    });
    expect(mockedLogServerError).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "[intake] batch autosave failed",
      }),
    );
  });

  it("falls back to the single fast RPC when the batch migration is not installed", async () => {
    const rpc = setupRpc((rpcName) => {
      if (rpcName === "autosave_intake_answers_batch") {
        return {
          data: null,
          error: {
            code: "PGRST202",
            message:
              "Could not find the function public.autosave_intake_answers_batch in the schema cache",
          },
        };
      }

      return { data: [successRow()], error: null };
    });

    await expect(autosave()).resolves.toEqual({
      ok: true,
      questionId: "question-1",
      value: "Executive answer",
      completionPercent: 50,
    });
    expect(rpc).toHaveBeenCalledWith(
      "autosave_intake_answer_fast",
      expect.any(Object),
    );
  });

  it("falls back gracefully when neither fast autosave migration is installed", async () => {
    setupRpc((rpcName) => ({
      data: null,
      error: {
        code: "PGRST202",
        message: `Could not find the function public.${rpcName} in the schema cache`,
      },
    }));
    mockedLoadUserProfileByAuthUserId.mockResolvedValueOnce(null);

    await expect(autosave()).resolves.toEqual({
      ok: false,
      message: "You do not have permission to answer this intake.",
    });
    expect(mockedLogServerError).not.toHaveBeenCalledWith(
      expect.objectContaining({
        label: "[intake] batch autosave failed",
      }),
    );
  });

  it("falls back gracefully when an installed autosave RPC is broken", async () => {
    setupRpc(() => ({
      data: null,
      error: {
        code: "42702",
        message: 'column reference "brand_id" is ambiguous',
      },
    }));
    mockedLoadUserProfileByAuthUserId.mockResolvedValueOnce(null);

    await expect(autosave()).resolves.toEqual({
      ok: false,
      message: "You do not have permission to answer this intake.",
    });
    expect(mockedLogServerError).not.toHaveBeenCalledWith(
      expect.objectContaining({
        label: "[intake] batch autosave failed",
      }),
    );
  });
});
