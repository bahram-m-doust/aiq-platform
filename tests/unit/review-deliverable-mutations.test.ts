import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { setReviewReportStatus } from "@/features/review-deliverables/mutation-service";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function setupMutation(data: { id: string } | null) {
  const builder = {
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve({ data, error: null })),
  };
  const from = vi.fn(() => builder);
  mockedCreateAdminClient.mockReturnValue({ from } as never);
  return { builder, from };
}

describe("review deliverable mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the report row when setting an approval decision", async () => {
    const { builder, from } = setupMutation({ id: "report-1" });

    await setReviewReportStatus({
      table: "stakeholder_interview_reports",
      brandId: "brand-1",
      profileId: "profile-1",
      status: "APPROVED",
    });

    expect(from).toHaveBeenCalledWith("stakeholder_interview_reports");
    expect(builder.eq).toHaveBeenCalledWith("brand_id", "brand-1");
    expect(builder.select).toHaveBeenCalledWith("id");
  });

  it("requires a report row to exist before reporting approval", async () => {
    setupMutation(null);

    await expect(
      setReviewReportStatus({
        table: "stakeholder_interview_reports",
        brandId: "brand-1",
        profileId: "profile-1",
        status: "APPROVED",
      }),
    ).rejects.toThrow(
      "The review item no longer exists or cannot be changed.",
    );
  });
});
