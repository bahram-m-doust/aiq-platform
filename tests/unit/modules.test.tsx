import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/modules/actions", () => ({
  uploadModuleArtifactAction: vi.fn(),
  sendModuleToClientReviewAction: vi.fn(),
  approveClientModuleAction: vi.fn(),
  requestClientModuleChangeAction: vi.fn(),
  initialModuleUploadFormState: { status: "idle", message: "" },
  initialModuleActionFormState: { status: "idle", message: "" },
}));

import { ClientReviewPanel } from "@/features/modules/components/ClientReviewPanel";
import { ModuleArtifactUploadForm } from "@/features/modules/components/ModuleArtifactUploadForm";
import { ModuleBoard } from "@/features/modules/components/ModuleBoard";
import { SupervisorReviewPanel } from "@/features/modules/components/SupervisorReviewPanel";
import {
  canClientReviewModuleRole,
  canInternalUserAccessModule,
  canSendArtifactToClientReview,
  canSendModuleToClientRole,
  canUploadModuleDraftRole,
  isCanonicalModuleType,
  latestArtifactIsClientReviewPdf,
  moduleTypeLabel,
  toArtifactAuditMetadata,
  toModuleAuditMetadata,
  validateClientModuleDecisionFormData,
  validateModuleUploadFormData,
} from "@/features/modules/schema";
import type {
  AdminModuleBoardItem,
  ClientModuleReviewPageData,
  ModuleArtifactRecord,
  ModuleRecord,
} from "@/features/modules/types";
import { formData } from "@/tests/helpers/formData";

function brandModule(overrides: Partial<ModuleRecord> = {}): ModuleRecord {
  return {
    id: "module-1",
    brandId: "brand-1",
    brandName: "Helio",
    moduleType: "Brand Knowledge",
    moduleTypeLabel: "Brand Knowledge",
    title: "Brand Knowledge",
    status: "INTERNAL_REVIEW",
    assignedTo: "specialist-1",
    assignedToEmail: "specialist@example.com",
    supervisorId: "supervisor-1",
    supervisorEmail: "supervisor@example.com",
    currentVersion: 1,
    createdAt: "2026-05-17T10:00:00.000Z",
    updatedAt: "2026-05-17T10:30:00.000Z",
    ...overrides,
  };
}

function artifact(
  overrides: Partial<ModuleArtifactRecord> = {},
): ModuleArtifactRecord {
  return {
    id: "artifact-1",
    moduleId: "module-1",
    artifactType: "PDF",
    fileId: "file-1",
    version: 1,
    status: "CLIENT_REVIEW",
    uploadedBy: "specialist-1",
    uploadedByEmail: "specialist@example.com",
    createdAt: "2026-05-17T10:15:00.000Z",
    file: {
      id: "file-1",
      brandId: "brand-1",
      storagePath: "brand-1/file-1/brand-knowledge.pdf",
      originalName: "brand-knowledge.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12000,
      visibility: "CLIENT_REVIEW",
      status: "CLIENT_REVIEW",
      uploadedBy: "specialist-1",
      uploadedByEmail: "specialist@example.com",
      createdAt: "2026-05-17T10:15:00.000Z",
    },
    ...overrides,
  };
}

function boardItem(
  overrides: Partial<AdminModuleBoardItem> = {},
): AdminModuleBoardItem {
  return {
    ...brandModule(),
    latestArtifact: artifact(),
    ...overrides,
  };
}

function clientReviewData(
  overrides: Partial<ClientModuleReviewPageData> = {},
): ClientModuleReviewPageData {
  const reviewModule = brandModule({ status: "CLIENT_REVIEW" });
  const latestClientArtifact = artifact();

  return {
    access: {
      brandId: "brand-1",
      brandName: "Helio",
      membershipRole: "OWNER",
      planName: "ADVANCED",
    },
    module: reviewModule,
    artifacts: [latestClientArtifact],
    latestClientArtifact,
    reviews: [],
    signedUrl: "https://signed.example/module.pdf?token=secret",
    signedUrlExpiresInSeconds: 60,
    markdown: null,
    comments: [],
    ...overrides,
  };
}

describe("module workflow validation", () => {
  it("validates canonical module labels and stored keys", () => {
    expect(isCanonicalModuleType("Brand Knowledge")).toBe(true);
    expect(isCanonicalModuleType("BRAND_KNOWLEDGE")).toBe(true);
    expect(moduleTypeLabel("BRAND_KNOWLEDGE")).toBe("Brand Knowledge");
    expect(isCanonicalModuleType("Experimental Module")).toBe(false);
  });

  it("checks internal and client role permissions", () => {
    expect(canUploadModuleDraftRole("INTERNAL_SPECIALIST")).toBe(true);
    expect(canSendModuleToClientRole("SUPERVISOR")).toBe(true);
    expect(canSendModuleToClientRole("INTERNAL_SPECIALIST")).toBe(false);
    expect(canClientReviewModuleRole("OWNER")).toBe(true);
    expect(canClientReviewModuleRole("BRAND_SPECIALIST")).toBe(false);

    expect(
      canInternalUserAccessModule({
        actorRole: "INTERNAL_SPECIALIST",
        profileId: "specialist-1",
        module: brandModule(),
      }),
    ).toBe(true);
    expect(
      canInternalUserAccessModule({
        actorRole: "INTERNAL_SPECIALIST",
        profileId: "other-specialist",
        module: brandModule(),
      }),
    ).toBe(false);
  });

  it("accepts DOCX/PDF uploads and rejects other file types", () => {
    const pdf = new File(["pdf"], "draft.pdf", { type: "application/pdf" });
    const docx = new File(["docx"], "draft.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const txt = new File(["text"], "draft.txt", { type: "text/plain" });

    expect(
      validateModuleUploadFormData(
        formData({ module_id: "module-1", file: pdf }),
      ).data?.artifactType,
    ).toBe("PDF");
    expect(
      validateModuleUploadFormData(
        formData({ module_id: "module-1", file: docx }),
      ).data?.artifactType,
    ).toBe("DOCX");
    expect(
      validateModuleUploadFormData(
        formData({ module_id: "module-1", file: txt }),
      ).error,
    ).toBe("Module drafts must be DOCX or PDF files.");
  });

  it("requires PDF supervisor gate and comment for client change request", () => {
    expect(canSendArtifactToClientReview(artifact())).toBe(true);
    expect(
      canSendArtifactToClientReview(artifact({ artifactType: "DOCX" })),
    ).toBe(false);
    expect(latestArtifactIsClientReviewPdf(artifact())).toBe(true);

    expect(
      validateClientModuleDecisionFormData({
        formData: formData({ module_id: "module-1" }),
        requireComment: true,
      }).error,
    ).toBe("Enter a comment before requesting changes.");
  });

  it("builds audit metadata without signed URLs or full comments", () => {
    const moduleAudit = toModuleAuditMetadata(brandModule());
    const artifactAudit = toArtifactAuditMetadata(artifact());
    const auditJson = JSON.stringify({ moduleAudit, artifactAudit });

    expect(moduleAudit).toMatchObject({
      module_id: "module-1",
      brand_id: "brand-1",
    });
    expect(artifactAudit).toMatchObject({
      artifact_id: "artifact-1",
      file_id: "file-1",
    });
    expect(auditJson).not.toContain("signed.example");
    expect(auditJson).not.toContain("token=");
  });
});

describe("module workflow components", () => {
  it("renders the admin module board", () => {
    render(
      <ModuleBoard
        actionLabel="Open module"
        basePath="/admin/modules"
        emptyDescription="No modules"
        emptyTitle="No modules"
        modules={[boardItem()]}
      />,
    );

    expect(screen.getByText("Brand Knowledge")).toBeVisible();
    expect(screen.getByRole("link", { name: /Open module/ })).toBeVisible();
  });

  it("renders the internal upload form", () => {
    render(<ModuleArtifactUploadForm module={brandModule()} />);

    expect(screen.getByLabelText("Draft file")).toBeVisible();
    expect(screen.getByRole("button", { name: "Upload draft" })).toBeVisible();
  });

  it("renders supervisor approval as enabled only for PDF artifacts", () => {
    render(
      <SupervisorReviewPanel
        actorRole="SUPERVISOR"
        latestArtifact={artifact()}
        module={brandModule()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /Approve for client review/ }),
    ).toBeEnabled();
  });

  it("renders the document review surface and decision controls", () => {
    render(
      <ClientReviewPanel
        currentUserId="user-1"
        data={clientReviewData({
          markdown: "# Overview\n\nThe brand knowledge summary.",
        })}
      />,
    );

    // Unified viewer renders the document content as commentable sections.
    expect(screen.getByText("Overview")).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve module" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Request change" })).toBeVisible();
  });
});
