import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  createReviewAnnotation,
  deleteReviewAnnotation,
  setReviewReportStatus,
  updateReviewAnnotation,
} from "@/features/review-deliverables/mutation-service";
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

function setupAnnotationCreate() {
  const row = {
    id: "annotation-1",
    report_id: "report-1",
    parent_id: "parent-1",
    author_id: "profile-1",
    page: 2,
    pos_x: "1",
    pos_y: "0",
    body: "Reply",
    resolved: false,
    created_at: "2026-06-10T00:00:00.000Z",
  };
  const builder = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: row, error: null })),
  };
  const from = vi.fn(() => builder);
  mockedCreateAdminClient.mockReturnValue({ from } as never);
  return { builder, from };
}

describe("review deliverable mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires an owned annotation row to be updated", async () => {
    const { builder, from } = setupMutation({ id: "annotation-1" });

    await updateReviewAnnotation({
      table: "stakeholder_interview_annotations",
      annotationId: "annotation-1",
      reportId: "report-1",
      authorId: "profile-1",
      body: "Updated",
    });

    expect(from).toHaveBeenCalledWith("stakeholder_interview_annotations");
    expect(builder.eq).toHaveBeenCalledWith("author_id", "profile-1");
    expect(builder.select).toHaveBeenCalledWith("id");
  });

  it("creates annotations through the shared normalized mutation", async () => {
    const { builder, from } = setupAnnotationCreate();

    const result = await createReviewAnnotation({
      table: "stakeholder_interview_annotations",
      reportId: "report-1",
      authorId: "profile-1",
      page: 2,
      posX: 4,
      posY: -3,
      body: "Reply",
      parentId: "parent-1",
    });

    expect(from).toHaveBeenCalledWith("stakeholder_interview_annotations");
    expect(builder.insert).toHaveBeenCalledWith({
      report_id: "report-1",
      author_id: "profile-1",
      page: 2,
      pos_x: 1,
      pos_y: 0,
      body: "Reply",
      parent_id: "parent-1",
    });
    expect(result).toMatchObject({
      id: "annotation-1",
      parentId: "parent-1",
      posX: 1,
      posY: 0,
    });
  });

  it("does not report success when no annotation was deleted", async () => {
    setupMutation(null);

    await expect(
      deleteReviewAnnotation({
        table: "futures_research_annotations",
        annotationId: "missing",
        reportId: "report-1",
        authorId: "profile-1",
      }),
    ).rejects.toThrow(
      "The review item no longer exists or cannot be changed.",
    );
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
