import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/audit/logAudit", () => ({
  logAudit: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/features/intake/docx-generator", () => ({
  generateIntakeDocx: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/logAudit";
import { generateIntakeDocx as mockedGenerateIntakeDocx } from "@/features/intake/docx-generator";
import { createIntakeKnowledgeFile } from "@/features/intake/intake-knowledge";
import { adminPromoteFileToRag } from "@/features/files/admin-services";
import {
  isRagApprovedSyncEligible,
  isRagSyncDisplayEligible,
} from "@/features/rag/schema";
import type { IntakeSnapshotJson } from "@/features/intake/types";
import type { UserProfile } from "@/features/auth/types";

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedLogAudit = vi.mocked(logAudit);
const mockedDocxGenerator = vi.mocked(mockedGenerateIntakeDocx);

function actor(): UserProfile {
  return {
    id: "owner-1",
    auth_user_id: "auth-owner-1",
    email: "owner@example.com",
    full_name: "Test Owner",
    global_role: "PLATFORM_OWNER",
  };
}

function snapshot(
  overrides: Partial<IntakeSnapshotJson> = {},
): IntakeSnapshotJson {
  return {
    version: 1,
    submittedAt: "2026-01-01T00:00:00.000Z",
    submittedBy: "owner-1",
    brand: {
      id: "brand-1",
      name: "Helio",
      planName: "BASIC",
      membershipRole: "OWNER",
    },
    session: {
      id: "session-1",
      status: "LOCKED",
      lockedAt: "2026-01-01T00:00:00.000Z",
      lockedBy: "owner-1",
      completionPercent: 100,
    },
    completion: {
      totalQuestions: 3,
      answeredQuestions: 2,
      completionPercent: 67,
      sections: [],
    },
    sections: [
      {
        id: "section-1",
        key: "COMPANY",
        title: "Company Info",
        description: null,
        orderIndex: 0,
        questions: [
          {
            id: "q1",
            key: "COMPANY_NAME",
            questionText: "What is the company name?",
            helpText: null,
            inputType: "text",
            orderIndex: 0,
            answer: { value: "Helio Corp" },
          },
          {
            id: "q2",
            key: "SERVICES",
            questionText: "What services do you offer?",
            helpText: null,
            inputType: "multi_select",
            orderIndex: 1,
            answer: { value: ["Design", "Development"] },
          },
          {
            id: "q3",
            key: "SKIPPED",
            questionText: "Optional question?",
            helpText: null,
            inputType: "text",
            orderIndex: 2,
            answer: { value: null },
          },
        ],
      },
      {
        id: "section-2",
        key: "GOALS",
        title: "Goals",
        description: null,
        orderIndex: 1,
        questions: [
          {
            id: "q4",
            key: "CONFIRMED",
            questionText: "Are you committed?",
            helpText: null,
            inputType: "checkbox",
            orderIndex: 0,
            answer: { value: true },
          },
        ],
      },
    ],
    ...overrides,
  };
}

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

function createResolvedBuilder(
  result: { data: unknown; error: null } | { data: null; error: unknown },
): QueryBuilder {
  const builder: QueryBuilder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
  };
  return builder;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DOCX generator", () => {
  // Use real implementation for these tests by importing the actual module
  // We need to call the real function, so we'll import it fresh
  async function callReal(snap: IntakeSnapshotJson) {
    // Bypass the mock for direct testing
    const { generateIntakeDocx } = await vi.importActual<
      typeof import("@/features/intake/docx-generator")
    >("@/features/intake/docx-generator");
    return generateIntakeDocx(snap);
  }

  async function extractDocXml(buffer: Buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const content = await zip.file("word/document.xml")?.async("string");
    return content ?? "";
  }

  it("produces a non-empty buffer from a complete snapshot", async () => {
    const buffer = await callReal(snapshot());
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("includes brand name in output", async () => {
    const buffer = await callReal(snapshot());
    const xml = await extractDocXml(buffer);
    expect(xml).toContain("Helio");
  });

  it("includes section titles and question text", async () => {
    const buffer = await callReal(snapshot());
    const xml = await extractDocXml(buffer);
    expect(xml).toContain("Company Info");
    expect(xml).toContain("What is the company name?");
    expect(xml).toContain("Helio Corp");
  });

  it("skips questions with null answers", async () => {
    const buffer = await callReal(snapshot());
    const xml = await extractDocXml(buffer);
    expect(xml).not.toContain("Optional question?");
  });

  it("handles array answers (multi-select) as comma-separated", async () => {
    const buffer = await callReal(snapshot());
    const xml = await extractDocXml(buffer);
    expect(xml).toContain("Design, Development");
  });

  it("handles boolean answers as Yes/No", async () => {
    const buffer = await callReal(snapshot());
    const xml = await extractDocXml(buffer);
    expect(xml).toContain("Yes");
  });
});

describe("createIntakeKnowledgeFile", () => {
  function setupAdminClient() {
    const fakeBuffer = Buffer.from("fake-docx-content");
    mockedDocxGenerator.mockResolvedValue(fakeBuffer);

    const storageUpload = vi.fn(() =>
      Promise.resolve({ data: { path: "test" }, error: null }),
    );
    const storage = {
      from: vi.fn(() => ({
        upload: storageUpload,
      })),
    };

    const filesBuilder = createResolvedBuilder({ data: null, error: null });
    const knowledgeFilesBuilder = createResolvedBuilder({
      data: null,
      error: null,
    });
    const snapshotsBuilder = createResolvedBuilder({
      data: null,
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "files") return filesBuilder;
      if (table === "knowledge_files") return knowledgeFilesBuilder;
      if (table === "intake_snapshots") return snapshotsBuilder;
      if (table === "audit_logs") {
        return createResolvedBuilder({ data: null, error: null });
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    mockedCreateAdminClient.mockReturnValue({ from, storage } as never);

    return {
      storageUpload,
      filesBuilder,
      knowledgeFilesBuilder,
      snapshotsBuilder,
      fakeBuffer,
    };
  }

  it("uploads buffer to storage and inserts file + knowledge_file rows", async () => {
    const { storageUpload, filesBuilder, knowledgeFilesBuilder } =
      setupAdminClient();

    await createIntakeKnowledgeFile({
      brandId: "brand-1",
      snapshotId: "snapshot-1",
      snapshotJson: snapshot(),
      profileId: "owner-1",
    });

    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(filesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        original_name: "Brand Intake.docx",
        status: "RAG_APPROVED",
        visibility: "HELIO_INTERNAL",
      }),
    );
    expect(knowledgeFilesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        module_id: null,
        rag_status: "RAG_APPROVED",
      }),
    );
  });

  it("updates intake_snapshots.generated_docx_file_id", async () => {
    const { snapshotsBuilder } = setupAdminClient();

    await createIntakeKnowledgeFile({
      brandId: "brand-1",
      snapshotId: "snapshot-1",
      snapshotJson: snapshot(),
      profileId: "owner-1",
    });

    expect(snapshotsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ generated_docx_file_id: expect.any(String) }),
    );
    expect(snapshotsBuilder.eq).toHaveBeenCalledWith("id", "snapshot-1");
  });

  it("logs audit with action intake_knowledge_generated", async () => {
    setupAdminClient();

    await createIntakeKnowledgeFile({
      brandId: "brand-1",
      snapshotId: "snapshot-1",
      snapshotJson: snapshot(),
      profileId: "owner-1",
    });

    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "intake_knowledge_generated",
        brandId: "brand-1",
        entityType: "file",
      }),
    );
  });

  it("propagates storage upload errors", async () => {
    mockedDocxGenerator.mockResolvedValue(Buffer.from("data"));

    const storage = {
      from: vi.fn(() => ({
        upload: vi.fn(() =>
          Promise.resolve({ data: null, error: new Error("Upload failed") }),
        ),
      })),
    };
    const from = vi.fn(() =>
      createResolvedBuilder({ data: null, error: null }),
    );
    mockedCreateAdminClient.mockReturnValue({ from, storage } as never);

    await expect(
      createIntakeKnowledgeFile({
        brandId: "brand-1",
        snapshotId: "snapshot-1",
        snapshotJson: snapshot(),
        profileId: "owner-1",
      }),
    ).rejects.toThrow("Upload failed");
  });
});

describe("adminPromoteFileToRag", () => {
  const fileRow = {
    id: "file-1",
    brand_id: "brand-1",
    storage_path: "brand-1/file-1/doc.pdf",
    original_name: "doc.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    visibility: "OWNER_ONLY",
    status: "UPLOADED",
    uploaded_by: "owner-1",
    created_at: "2026-01-01T00:00:00.000Z",
  };

  function setupFileExists(status = "UPLOADED") {
    const row = { ...fileRow, status };
    const ragRow = { ...row, status: "RAG_APPROVED" };

    const selectBuilder = createResolvedBuilder({
      data: row,
      error: null,
    });

    const updateBuilder = createResolvedBuilder({
      data: ragRow,
      error: null,
    });

    const upsertBuilder = createResolvedBuilder({
      data: null,
      error: null,
    });

    const auditBuilder = createResolvedBuilder({
      data: null,
      error: null,
    });

    let selectCallCount = 0;
    const from = vi.fn((table: string) => {
      if (table === "files") {
        selectCallCount++;
        return selectCallCount === 1 ? selectBuilder : updateBuilder;
      }
      if (table === "knowledge_files") return upsertBuilder;
      if (table === "audit_logs") return auditBuilder;
      throw new Error(`Unexpected table: ${table}`);
    });

    mockedCreateAdminClient.mockReturnValue({ from } as never);

    return { updateBuilder, upsertBuilder };
  }

  it("updates file status and upserts knowledge_file", async () => {
    const { updateBuilder, upsertBuilder } = setupFileExists("UPLOADED");

    await adminPromoteFileToRag({ fileId: "file-1", actor: actor() });

    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: "RAG_APPROVED",
    });
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        module_id: null,
        file_id: "file-1",
        rag_status: "RAG_APPROVED",
      }),
      expect.objectContaining({ onConflict: "brand_id, file_id" }),
    );
  });

  it("rejects archived files with DomainError", async () => {
    setupFileExists("ARCHIVED");

    await expect(
      adminPromoteFileToRag({ fileId: "file-1", actor: actor() }),
    ).rejects.toThrow("Cannot promote an archived file to RAG.");
  });

  it("is idempotent for already-RAG_APPROVED files", async () => {
    setupFileExists("RAG_APPROVED");

    const result = await adminPromoteFileToRag({
      fileId: "file-1",
      actor: actor(),
    });

    expect(result.status).toBe("RAG_APPROVED");
    expect(mockedLogAudit).not.toHaveBeenCalled();
  });

  it("logs audit with action admin_file_rag_promoted", async () => {
    setupFileExists("UPLOADED");

    await adminPromoteFileToRag({ fileId: "file-1", actor: actor() });

    expect(mockedLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin_file_rag_promoted",
        entityType: "file",
        entityId: "file-1",
      }),
    );
  });
});

describe("standalone RAG sync eligibility", () => {
  it("standalone file eligible when ragStatus + fileStatus = RAG_APPROVED with defaults", () => {
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_APPROVED",
        fileStatus: "RAG_APPROVED",
        brandMatches: true,
      }),
    ).toBe(true);
  });

  it("standalone file ineligible when fileStatus !== RAG_APPROVED", () => {
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_APPROVED",
        fileStatus: "UPLOADED",
        brandMatches: true,
      }),
    ).toBe(false);
  });

  it("standalone file ineligible when brands do not match", () => {
    expect(
      isRagApprovedSyncEligible({
        ragStatus: "RAG_APPROVED",
        fileStatus: "RAG_APPROVED",
        brandMatches: false,
      }),
    ).toBe(false);
  });

  it("display-eligible for RAG_SYNCED standalone files", () => {
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

  it("display-eligible for SYNCING standalone files", () => {
    expect(
      isRagSyncDisplayEligible({
        ragStatus: "SYNCING",
        fileStatus: "RAG_APPROVED",
        brandMatches: true,
        moduleStatus: "RAG_APPROVED",
        artifactType: "PDF",
        artifactStatus: "RAG_APPROVED",
      }),
    ).toBe(true);
  });

  it("module-based file requires PDF artifact type", () => {
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
  });
});
