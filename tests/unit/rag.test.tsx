import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/rag/actions", () => ({
  approveRagSupervisorAction: vi.fn(),
  approveRagPlatformOwnerAction: vi.fn(),
  syncBrandKnowledgeBaseAction: vi.fn(),
}));

vi.mock("@/features/rag/queries", () => ({
  getEligibleRagApprovalItemByArtifactId: vi.fn(),
  getRagApprovedFilesForSync: vi.fn(),
}));

vi.mock("@/features/files/storage", () => ({
  downloadPrivateFile: vi.fn(),
}));

vi.mock("@/features/rag/openai", () => ({
  createOpenAIFileSearchVectorStore: vi.fn(),
  hasOpenAIFileSearchEnv: vi.fn(),
  uploadOpenAIFileToVectorStore: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  getEligibleRagApprovalItemByArtifactId,
  getRagApprovedFilesForSync,
} from "@/features/rag/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { downloadPrivateFile } from "@/features/files/storage";
import { RagApprovalQueue } from "@/features/rag/components/RagApprovalQueue";
import { RagSyncPanel } from "@/features/rag/components/RagSyncPanel";
import {
  createOpenAIFileSearchVectorStore,
  hasOpenAIFileSearchEnv,
  uploadOpenAIFileToVectorStore,
} from "@/features/rag/openai";
import {
  canSyncRagRole,
  canPlatformOwnerApproveRag,
  canSupervisorApproveRag,
  isEligibleRagArtifactStatus,
  isEligibleRagFileStatus,
  isEligibleRagModuleStatus,
  isRagApprovedSyncEligible,
  isRagSyncDisplayEligible,
  ragApprovalStateForItem,
  toRagApprovalAuditMetadata,
  toRagSyncAuditMetadata,
  validateRagApprovalTargetFormData,
  validateRagSyncBrandFormData,
} from "@/features/rag/schema";
import {
  approveRagAsPlatformOwner,
  approveRagAsSupervisor,
  isRagApprovalServiceError,
} from "@/features/rag/services";
import {
  isRagSyncServiceError,
  syncBrandKnowledgeBase,
} from "@/features/rag/sync";
import type { UserProfile } from "@/features/auth/types";
import type {
  RagApprovalQueueItem,
  RagApprovedSyncFile,
  RagSyncBrandGroup,
} from "@/features/rag/types";
import { formData } from "@/tests/helpers/formData";

const mockedGetEligibleItem = vi.mocked(getEligibleRagApprovalItemByArtifactId);
const mockedGetApprovedFilesForSync = vi.mocked(getRagApprovedFilesForSync);
const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedDownloadPrivateFile = vi.mocked(downloadPrivateFile);
const mockedCreateVectorStore = vi.mocked(createOpenAIFileSearchVectorStore);
const mockedHasOpenAIEnv = vi.mocked(hasOpenAIFileSearchEnv);
const mockedUploadToVectorStore = vi.mocked(uploadOpenAIFileToVectorStore);

function profile(role: UserProfile["global_role"]): UserProfile {
  return {
    id: `${role.toLowerCase()}-1`,
    auth_user_id: `auth-${role.toLowerCase()}-1`,
    email: `${role.toLowerCase()}@example.com`,
    full_name: null,
    global_role: role,
  };
}

function queueItem(
  overrides: Partial<RagApprovalQueueItem> = {},
): RagApprovalQueueItem {
  return {
    brandId: "brand-1",
    brandName: "Helio",
    moduleId: "module-1",
    moduleTitle: "Brand Knowledge",
    moduleType: "Brand Knowledge",
    moduleStatus: "CLIENT_APPROVED",
    artifactId: "artifact-1",
    artifactVersion: 2,
    artifactStatus: "CLIENT_APPROVED",
    fileId: "file-1",
    fileName: "brand-knowledge.pdf",
    fileStatus: "CLIENT_APPROVED",
    knowledgeFileId: null,
    ragStatus: "CLIENT_APPROVED",
    approvedBySupervisor: null,
    approvedByPlatformOwner: null,
    createdAt: null,
    ...overrides,
  };
}

describe("RAG approval rules", () => {
  it("enforces role-specific approval capabilities", () => {
    expect(canSupervisorApproveRag("SUPERVISOR")).toBe(true);
    expect(canSupervisorApproveRag("PLATFORM_OWNER")).toBe(false);
    expect(canPlatformOwnerApproveRag("PLATFORM_OWNER")).toBe(true);
    expect(canPlatformOwnerApproveRag("SUPERVISOR")).toBe(false);
    expect(canSyncRagRole("PLATFORM_OWNER")).toBe(true);
    expect(canSyncRagRole("SUPERVISOR")).toBe(false);
  });

  it("keeps queue eligibility PDF and status scoped", () => {
    expect(isEligibleRagModuleStatus("CLIENT_APPROVED")).toBe(true);
    expect(isEligibleRagModuleStatus("CLIENT_REVIEW")).toBe(false);
    expect(isEligibleRagArtifactStatus("RAG_REVIEW_REQUIRED")).toBe(true);
    expect(isEligibleRagArtifactStatus("INTERNAL_DRAFT")).toBe(false);
    expect(isEligibleRagFileStatus("CLIENT_APPROVED")).toBe(true);
    expect(isEligibleRagFileStatus("CLIENT_REVIEW")).toBe(false);
  });

  it("validates action targets and queue states", () => {
    expect(
      validateRagApprovalTargetFormData(
        formData({ artifact_id: " artifact-1 " }),
      ).artifactId,
    ).toBe("artifact-1");
    expect(validateRagApprovalTargetFormData(new FormData()).error).toBe(
      "RAG approval target is missing.",
    );
    expect(ragApprovalStateForItem(queueItem())).toBe("PENDING_SUPERVISOR");
    expect(
      ragApprovalStateForItem(
        queueItem({
          knowledgeFileId: "knowledge-1",
          ragStatus: "RAG_REVIEW_REQUIRED",
          approvedBySupervisor: "supervisor-1",
        }),
      ),
    ).toBe("PENDING_PLATFORM_OWNER");
  });

  it("allows future sync reads only for RAG_APPROVED file records", () => {
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_APPROVED",
        fileStatus: "RAG_APPROVED",
        brandMatches: true,
      }),
    ).toBe(true);
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_REVIEW_REQUIRED",
        fileStatus: "RAG_APPROVED",
        brandMatches: true,
      }),
    ).toBe(false);
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_APPROVED",
        fileStatus: "CLIENT_APPROVED",
        brandMatches: true,
      }),
    ).toBe(false);
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_APPROVED",
        fileStatus: "RAG_APPROVED",
        brandMatches: true,
        moduleStatus: "RAG_APPROVED",
        artifactType: "DOCX",
        artifactStatus: "RAG_APPROVED",
      }),
    ).toBe(false);
    expect(
      isRagSyncDisplayEligible({
        ragStatus: "RAG_SYNCED",
        fileStatus: "RAG_APPROVED",
        brandMatches: true,
        moduleStatus: "RAG_APPROVED",
        artifactType: "PDF",
        artifactStatus: "RAG_APPROVED",
      }),
    ).toBe(true);
  });

  it("validates sync form input", () => {
    expect(validateRagSyncBrandFormData(formData({ brand_id: " brand-1 " })))
      .toEqual({
        brandId: "brand-1",
        error: null,
      });
    expect(validateRagSyncBrandFormData(new FormData()).error).toBe(
      "RAG sync brand is missing.",
    );
  });

  it("builds safe audit metadata only", () => {
    const audit = toRagApprovalAuditMetadata({
      item: queueItem(),
      oldStatus: "CLIENT_APPROVED",
      newStatus: "RAG_REVIEW_REQUIRED",
      approvalStage: "SUPERVISOR",
      actorId: "supervisor-1",
    });
    const auditJson = JSON.stringify(audit);

    expect(audit).toEqual({
      brand_id: "brand-1",
      module_id: "module-1",
      artifact_id: "artifact-1",
      file_id: "file-1",
      old_status: "CLIENT_APPROVED",
      new_status: "RAG_REVIEW_REQUIRED",
      approval_stage: "SUPERVISOR",
      actor_id: "supervisor-1",
    });
    expect(auditJson).not.toContain("signed");
    expect(auditJson).not.toContain("brand-knowledge.pdf");
  });

  it("builds safe sync audit metadata only", () => {
    const audit = toRagSyncAuditMetadata({
      brandId: "brand-1",
      providerVectorStoreId: "vs_123",
      actorId: "platform-owner-1",
      attemptedKnowledgeFileIds: ["knowledge-1"],
      syncedKnowledgeFileIds: ["knowledge-1"],
      failedKnowledgeFileIds: [],
      oldStatus: "SYNCING",
      newStatus: "RAG_SYNCED",
    });
    const auditJson = JSON.stringify(audit);

    expect(audit).toMatchObject({
      brand_id: "brand-1",
      provider_vector_store_id: "vs_123",
      actor_id: "platform-owner-1",
      attempted_count: 1,
      synced_count: 1,
      failed_count: 0,
      old_status: "SYNCING",
      new_status: "RAG_SYNCED",
    });
    expect(auditJson).not.toContain("signed");
    expect(auditJson).not.toContain("brand-knowledge.pdf");
  });
});

describe("RAG approval service guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not downgrade an already RAG_APPROVED knowledge file", async () => {
    mockedGetEligibleItem.mockResolvedValue(
      queueItem({
        knowledgeFileId: "knowledge-1",
        ragStatus: "RAG_APPROVED",
        approvedBySupervisor: "supervisor-1",
        approvedByPlatformOwner: "platform_owner-1",
        moduleStatus: "RAG_APPROVED",
        artifactStatus: "RAG_APPROVED",
        fileStatus: "RAG_APPROVED",
      }),
    );

    const result = await approveRagAsSupervisor({
      artifactId: "artifact-1",
      actor: profile("SUPERVISOR"),
    });

    expect(result.alreadyApproved).toBe(true);
    expect(result.item.ragStatus).toBe("RAG_APPROVED");
  });

  it("blocks Platform Owner final approval before Supervisor approval", async () => {
    mockedGetEligibleItem.mockResolvedValue(queueItem());

    await expect(
      approveRagAsPlatformOwner({
        artifactId: "artifact-1",
        actor: profile("PLATFORM_OWNER"),
      }),
    ).rejects.toSatisfy(isRagApprovalServiceError);
  });

  it("rejects cross-role approval attempts", async () => {
    await expect(
      approveRagAsSupervisor({
        artifactId: "artifact-1",
        actor: profile("PLATFORM_OWNER"),
      }),
    ).rejects.toSatisfy(isRagApprovalServiceError);
    await expect(
      approveRagAsPlatformOwner({
        artifactId: "artifact-1",
        actor: profile("SUPERVISOR"),
      }),
    ).rejects.toSatisfy(isRagApprovalServiceError);
  });
});

describe("RAG approval queue components", () => {
  it("renders a Supervisor approval action for pending items", () => {
    render(<RagApprovalQueue actorRole="SUPERVISOR" items={[queueItem()]} />);

    expect(screen.getByText("Brand Knowledge")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Supervisor approve" }),
    ).toBeVisible();
  });

  it("renders a Platform Owner final approval action after Supervisor approval", () => {
    render(
      <RagApprovalQueue
        actorRole="PLATFORM_OWNER"
        items={[
          queueItem({
            knowledgeFileId: "knowledge-1",
            ragStatus: "RAG_REVIEW_REQUIRED",
            approvedBySupervisor: "supervisor-1",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Final RAG approve" }),
    ).toBeVisible();
  });

  it("renders approved state without action buttons", () => {
    render(
      <RagApprovalQueue
        actorRole="PLATFORM_OWNER"
        items={[
          queueItem({
            knowledgeFileId: "knowledge-1",
            ragStatus: "RAG_APPROVED",
            approvedBySupervisor: "supervisor-1",
            approvedByPlatformOwner: "platform-owner-1",
          }),
        ]}
      />,
    );

    expect(screen.getByText("RAG approval complete")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
};

function createResolvedBuilder(result: unknown): QueryBuilder {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    in: vi.fn(() => builder),
  } as QueryBuilder;

  return builder;
}

function syncFile(overrides: Partial<RagApprovedSyncFile> = {}): RagApprovedSyncFile {
  return {
    knowledgeFileId: "knowledge-1",
    brandId: "brand-1",
    moduleId: "module-1",
    artifactId: "artifact-1",
    artifactVersion: 1,
    fileId: "file-1",
    storagePath: "brand-1/module-1/file.pdf",
    originalName: "brand-knowledge.pdf",
    mimeType: "application/pdf",
    ...overrides,
  };
}

function setupSyncAdminClient({
  existingKnowledgeBase = null,
  markFileIds = ["knowledge-1"],
}: {
  existingKnowledgeBase?: Record<string, unknown> | null;
  markFileIds?: string[];
} = {}) {
  const brandBuilder = createResolvedBuilder({
    data: { id: "brand-1", name: "Helio" },
    error: null,
  });
  const existingKnowledgeBaseBuilder = createResolvedBuilder({
    data: existingKnowledgeBase,
    error: null,
  });
  const insertedKnowledgeBaseBuilder = createResolvedBuilder({
    data: {
      id: "kb-1",
      brand_id: "brand-1",
      provider: "OPENAI_FILE_SEARCH",
      provider_vector_store_id: null,
      status: "NOT_READY",
    },
    error: null,
  });
  const syncKnowledgeBaseBuilder = createResolvedBuilder({
    data: {
      id: "kb-1",
      brand_id: "brand-1",
      provider: "OPENAI_FILE_SEARCH",
      provider_vector_store_id: null,
      status: "SYNCING",
    },
    error: null,
  });
  const vectorKnowledgeBaseBuilder = createResolvedBuilder({
    data: {
      id: "kb-1",
      brand_id: "brand-1",
      provider: "OPENAI_FILE_SEARCH",
      provider_vector_store_id: "vs_123",
      status: "SYNCING",
    },
    error: null,
  });
  const finalKnowledgeBaseBuilder = createResolvedBuilder({
    data: {
      id: "kb-1",
      brand_id: "brand-1",
      provider: "OPENAI_FILE_SEARCH",
      provider_vector_store_id: "vs_123",
      status: "RAG_SYNCED",
    },
    error: null,
  });
  const markFilesBuilder = createResolvedBuilder({
    data: markFileIds.map((id) => ({ id })),
    error: null,
  });
  const fileResultBuilder = createResolvedBuilder({ data: null, error: null });
  const auditBuilder = createResolvedBuilder({ data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "brands") return brandBuilder;
    if (table === "audit_logs") return auditBuilder;
    if (table === "knowledge_bases") {
      const knowledgeBaseCalls = from.mock.calls.filter(
        ([calledTable]) => calledTable === "knowledge_bases",
      ).length;

      if (knowledgeBaseCalls === 1) return existingKnowledgeBaseBuilder;
      if (knowledgeBaseCalls === 2 && !existingKnowledgeBase) {
        return insertedKnowledgeBaseBuilder;
      }
      if (
        (knowledgeBaseCalls === 2 && existingKnowledgeBase) ||
        (knowledgeBaseCalls === 3 && !existingKnowledgeBase)
      ) {
        return syncKnowledgeBaseBuilder;
      }
      if (
        (knowledgeBaseCalls === 3 && existingKnowledgeBase) ||
        (knowledgeBaseCalls === 4 && !existingKnowledgeBase)
      ) {
        return vectorKnowledgeBaseBuilder;
      }

      return finalKnowledgeBaseBuilder;
    }

    if (table === "knowledge_files") {
      const knowledgeFileCalls = from.mock.calls.filter(
        ([calledTable]) => calledTable === "knowledge_files",
      ).length;

      return knowledgeFileCalls === 1 ? markFilesBuilder : fileResultBuilder;
    }

    throw new Error(`Unexpected table ${table}`);
  });

  mockedCreateAdminClient.mockReturnValue({ from } as never);

  return {
    from,
    markFilesBuilder,
    fileResultBuilder,
    auditBuilder,
  };
}

describe("RAG sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedHasOpenAIEnv.mockReturnValue(true);
    mockedGetApprovedFilesForSync.mockResolvedValue([syncFile()]);
    mockedDownloadPrivateFile.mockResolvedValue(
      new Blob(["pdf bytes"], { type: "application/pdf" }),
    );
    mockedCreateVectorStore.mockResolvedValue({
      providerVectorStoreId: "vs_123",
      status: "completed",
    });
    mockedUploadToVectorStore.mockResolvedValue({
      providerFileId: "file_openai_1",
      vectorStoreFileId: "vsf_1",
      status: "completed",
      errorMessage: null,
    });
  });

  it("blocks non-Platform Owner sync attempts", async () => {
    await expect(
      syncBrandKnowledgeBase({
        brandId: "brand-1",
        triggeredBy: profile("SUPERVISOR"),
      }),
    ).rejects.toSatisfy(isRagSyncServiceError);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it("returns a controlled error before status changes when OPENAI_API_KEY is missing", async () => {
    mockedHasOpenAIEnv.mockReturnValue(false);
    setupSyncAdminClient();

    await expect(
      syncBrandKnowledgeBase({
        brandId: "brand-1",
        triggeredBy: profile("PLATFORM_OWNER"),
      }),
    ).rejects.toSatisfy(isRagSyncServiceError);

    expect(mockedCreateVectorStore).not.toHaveBeenCalled();
    expect(mockedUploadToVectorStore).not.toHaveBeenCalled();
  });

  it("moves RAG_APPROVED files through SYNCING to RAG_SYNCED and audits the sync", async () => {
    const { markFilesBuilder, fileResultBuilder, auditBuilder } =
      setupSyncAdminClient();

    const result = await syncBrandKnowledgeBase({
      brandId: "brand-1",
      triggeredBy: profile("PLATFORM_OWNER"),
    });

    expect(result).toMatchObject({
      brandId: "brand-1",
      providerVectorStoreId: "vs_123",
      attemptedCount: 1,
      syncedCount: 1,
      failedCount: 0,
    });
    expect(markFilesBuilder.update).toHaveBeenCalledWith({
      rag_status: "SYNCING",
    });
    expect(fileResultBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rag_status: "RAG_SYNCED",
        provider_file_id: "file_openai_1",
      }),
    );
    expect(auditBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rag_sync_started" }),
    );
    expect(auditBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rag_sync_completed" }),
    );
  });

  it("marks only the failed file SYNC_FAILED when OpenAI ingestion fails", async () => {
    const { fileResultBuilder } = setupSyncAdminClient();

    mockedUploadToVectorStore.mockResolvedValue({
      providerFileId: "file_openai_1",
      vectorStoreFileId: "vsf_1",
      status: "failed",
      errorMessage: "invalid file",
    });

    const result = await syncBrandKnowledgeBase({
      brandId: "brand-1",
      triggeredBy: profile("PLATFORM_OWNER"),
    });

    expect(result.failedCount).toBe(1);
    expect(fileResultBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        rag_status: "SYNC_FAILED",
        provider_file_id: "file_openai_1",
      }),
    );
  });
});

describe("RAG sync panel components", () => {
  function syncGroup(
    overrides: Partial<RagSyncBrandGroup> = {},
  ): RagSyncBrandGroup {
    return {
      brandId: "brand-1",
      brandName: "Helio",
      providerVectorStoreId: "vs_123456789",
      knowledgeBaseStatus: "NOT_READY",
      eligibleCount: 1,
      syncingCount: 0,
      syncedCount: 0,
      failedCount: 0,
      files: [
        {
          ...syncFile(),
          ragStatus: "RAG_APPROVED",
          providerFileId: null,
          syncedAt: null,
        },
      ],
      ...overrides,
    };
  }

  it("renders Platform Owner sync controls for eligible RAG_APPROVED files", () => {
    render(<RagSyncPanel groups={[syncGroup()]} />);

    expect(screen.getByText("OpenAI File Search sync")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Sync approved files" }),
    ).toBeEnabled();
    expect(screen.getByText("RAG approved")).toBeVisible();
  });

  it("disables sync when no RAG_APPROVED files remain eligible", () => {
    render(
      <RagSyncPanel
        groups={[
          syncGroup({
            eligibleCount: 0,
            failedCount: 1,
            files: [
              {
                ...syncFile(),
                ragStatus: "SYNC_FAILED",
                providerFileId: null,
                syncedAt: null,
              },
            ],
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Sync approved files" }),
    ).toBeDisabled();
    expect(screen.getByText("Sync failed")).toBeVisible();
  });
});
