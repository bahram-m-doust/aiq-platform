import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/notifications/mutation-service", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/lib/email/sendEmail", () => ({
  sendEmailWithResend: vi.fn(),
}));

vi.mock("@/features/auth/origins", () => ({
  resolveTrustedAppOrigin: vi.fn(),
}));

vi.mock("@/lib/logging/server", () => ({
  logServerError: vi.fn(),
}));

vi.mock("@/features/change-requests/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/change-requests/queries")
  >("@/features/change-requests/queries");

  return {
    ...actual,
    getChangeRequestById: vi.fn(),
  };
});

import { resolveTrustedAppOrigin } from "@/features/auth/origins";
import { getChangeRequestById } from "@/features/change-requests/queries";
import { reviewChangeRequest } from "@/features/change-requests/services";
import { createNotification } from "@/features/notifications/mutation-service";
import { sendEmailWithResend } from "@/lib/email/sendEmail";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChangeRequestRecord } from "@/features/change-requests/types";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedGetChangeRequestById = vi.mocked(getChangeRequestById);
const mockedCreateNotification = vi.mocked(createNotification);
const mockedSendEmail = vi.mocked(sendEmailWithResend);
const mockedResolveOrigin = vi.mocked(resolveTrustedAppOrigin);

function makeChangeRequest(overrides: Partial<ChangeRequestRecord> = {}): ChangeRequestRecord {
  return {
    id: "request-1",
    brandId: "brand-1",
    targetType: "INTAKE_SECTION",
    targetId: null,
    sectionKey: "COMPANY",
    questionId: null,
    requestedBy: "profile-1",
    reason: "Please update the locked answer.",
    comment: "The answer should reflect the new positioning.",
    status: "REQUESTED",
    reviewedBy: null,
    resolutionNote: null,
    createdAt: "2026-05-16T12:00:00.000Z",
    updatedAt: "2026-05-16T12:00:00.000Z",
    ...overrides,
  };
}

describe("change request review delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetChangeRequestById.mockResolvedValue(makeChangeRequest());
    mockedResolveOrigin.mockReturnValue("https://bextudio.test");
    mockedCreateNotification.mockResolvedValue(undefined);
    mockedSendEmail.mockResolvedValue({ ok: true, id: "email-1" });
  });

  it("sends the reviewer email and creates a client notification after review", async () => {
    const updatedRow = {
      id: "request-1",
      brand_id: "brand-1",
      target_type: "INTAKE_SECTION",
      target_id: null,
      section_key: "COMPANY",
      question_id: null,
      requested_by: "profile-1",
      reason: "Please update the locked answer.",
      comment: "The answer should reflect the new positioning.",
      status: "APPROVED",
      reviewed_by: "reviewer-1",
      resolution_note: "Approved with edits.",
      created_at: "2026-05-16T12:00:00.000Z",
      updated_at: "2026-05-16T12:01:00.000Z",
    };

    const profileBuilder = {
      select: vi.fn(() => profileBuilder),
      eq: vi.fn(() => profileBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: { email: "owner@example.com" },
          error: null,
        }),
      ),
    };
    const brandBuilder = {
      select: vi.fn(() => brandBuilder),
      eq: vi.fn(() => brandBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: { name: "Helio" },
          error: null,
        }),
      ),
    };
    const intakeSelectBuilder = {
      select: vi.fn(() => intakeSelectBuilder),
      eq: vi.fn(() => intakeSelectBuilder),
      order: vi.fn(() => intakeSelectBuilder),
      limit: vi.fn(() => intakeSelectBuilder),
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: {
            id: "session-1",
            brand_id: "brand-1",
            status: "LOCKED",
            completion_percent: 100,
            locked_at: "2026-05-16T12:00:00.000Z",
            locked_by: "profile-1",
          },
          error: null,
        }),
      ),
    };
    const intakeUpdateBuilder = {
      update: vi.fn(() => intakeUpdateBuilder),
      eq: vi.fn(() => intakeUpdateBuilder),
    };
    const intakeBuilder = {
      select: vi.fn(() => intakeSelectBuilder),
      update: vi.fn(() => intakeUpdateBuilder),
    };
    const updateBuilder = {
      update: vi.fn(() => updateBuilder),
      eq: vi.fn(() => updateBuilder),
      is: vi.fn(() => updateBuilder),
      select: vi.fn(() => updateBuilder),
      single: vi.fn(() =>
        Promise.resolve({
          data: updatedRow,
          error: null,
        }),
      ),
    };
    const from = vi.fn((table: string) => {
      if (table === "change_requests") return updateBuilder;
      if (table === "users_profile") return profileBuilder;
      if (table === "brands") return brandBuilder;
      if (table === "intake_sessions") return intakeBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    const result = await reviewChangeRequest({
      input: {
        requestId: "request-1",
        status: "APPROVED",
        resolutionNote: "Approved with edits.",
      },
      reviewerId: "reviewer-1",
      actorRole: "PLATFORM_OWNER",
    });

    expect(result.status).toBe("APPROVED");
    expect(mockedCreateNotification).toHaveBeenCalledWith({
      brandId: "brand-1",
      audience: "CLIENT",
      recipientId: "profile-1",
      type: "change_request_reviewed",
      title: "Change request approved",
      body: expect.stringContaining("Your change request for Helio is now approved."),
      linkPath: "/integrated-brand-brain/roadmap/questionnaire",
      subjectType: "change_request",
      subjectId: "request-1",
      actorId: "reviewer-1",
    });
    expect(mockedSendEmail).toHaveBeenCalledWith({
      to: "owner@example.com",
      subject: "Change request approved",
      text: expect.stringContaining("Your change request for Helio is now approved."),
      html: expect.stringContaining("Open your dashboard"),
    });
    expect(
      JSON.stringify(mockedCreateNotification.mock.calls[0]?.[0]),
    ).toContain("Your questionnaire has been reopened for editing.");
    // The reopen patch is passed to the builder `.from()` returns (the
    // `.update(patch)` call), then `.eq()` is chained on its result — so assert
    // on intakeBuilder.update, which is what actually receives the patch.
    expect(intakeBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "DRAFT",
        locked_at: null,
        locked_by: null,
      }),
    );
  });
});
