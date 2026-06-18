import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { listCommentsForSubject } from "@/features/review-comments/queries";
import { setReviewReportStatus } from "@/features/review-deliverables/mutation-service";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedCreateAdminClient = vi.mocked(createAdminClient);

function setupMutation(data: { id: string } | null) {
  const builder = {
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
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
    // Status guard: only transition from an awaiting-decision state, so a
    // concurrent reset can't be overwritten with APPROVED.
    expect(builder.in).toHaveBeenCalledWith("status", [
      "CLIENT_REVIEW",
      "CHANGES_REQUESTED",
    ]);
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

describe("review comment author privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupCommentList(rows: unknown[]) {
    const selectCalls: string[] = [];
    const builder = {
      select: vi.fn((columns: string) => {
        selectCalls.push(columns);
        return builder;
      }),
      eq: vi.fn(() => builder),
      order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    };
    const from = vi.fn(() => builder);
    mockedCreateAdminClient.mockReturnValue({ from } as never);
    return { selectCalls };
  }

  // Comments are sent to the client-facing review surfaces, so the internal
  // author's email must never be requested from the DB nor reach the browser.
  it("never selects or returns the comment author's email", async () => {
    const { selectCalls } = setupCommentList([
      {
        id: "c-1",
        brand_id: "brand-1",
        subject_type: "MODULE",
        subject_id: "m-1",
        parent_id: null,
        anchor_id: null,
        anchor_label: null,
        highlight_start: null,
        highlight_end: null,
        highlight_text: null,
        author_id: "p-1",
        body: "Looks good",
        resolved: false,
        created_at: null,
        updated_at: null,
        author: { full_name: "Pat Reviewer" },
      },
    ]);

    const comments = await listCommentsForSubject({
      subjectType: "MODULE",
      subjectId: "m-1",
      brandId: "brand-1",
    });

    for (const columns of selectCalls) {
      expect(columns).not.toContain("email");
    }
    expect(JSON.stringify(comments)).not.toContain("email");
    expect(comments[0]).not.toHaveProperty("authorEmail");
    expect(comments[0]?.authorName).toBe("Pat Reviewer");
  });
});
