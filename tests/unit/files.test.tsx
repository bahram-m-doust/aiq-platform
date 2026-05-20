import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/files/actions", () => ({
  uploadFileAction: vi.fn(),
  createSignedDownloadUrlAction: vi.fn(),
  approveSpecialistFileAction: vi.fn(),
  rejectSpecialistFileAction: vi.fn(),
}));

import { FileList } from "@/features/files/components/FileList";
import { FileUploader } from "@/features/files/components/FileUploader";
import {
  buildStoragePath,
  canDownloadFile,
  canReviewSpecialistFile,
  getUploadVisibilityOptions,
  sanitizeFileName,
  statusForUploadedFile,
  toFileAuditMetadata,
  validateFileUploadFormData,
} from "@/features/files/schema";
import type {
  BrandFileRecord,
  FileAccessContext,
} from "@/features/files/types";

function formData(values: { file?: File; visibility?: string }) {
  const data = new FormData();

  if (values.file) {
    data.set("file", values.file);
  }

  if (values.visibility) {
    data.set("visibility", values.visibility);
  }

  return data;
}

const ownerAccess: FileAccessContext = {
  brandId: "brand-1",
  brandName: "Helio",
  membershipRole: "OWNER",
  planName: "ADVANCED",
};

const specialistAccess: FileAccessContext = {
  ...ownerAccess,
  membershipRole: "BRAND_SPECIALIST",
};

function brandFile(overrides: Partial<BrandFileRecord> = {}): BrandFileRecord {
  return {
    id: "file-1",
    brandId: "brand-1",
    storagePath: "brand-1/file-1/strategy.pdf",
    originalName: "strategy.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    visibility: "BRAND_TEAM",
    status: "UPLOADED",
    uploadedBy: "owner-1",
    uploadedByEmail: "owner@example.com",
    createdAt: "2026-05-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("file upload validation and paths", () => {
  it("sets Specialist uploads to pending Owner approval", () => {
    expect(statusForUploadedFile("BRAND_SPECIALIST")).toBe(
      "PENDING_OWNER_APPROVAL",
    );
    expect(statusForUploadedFile("OWNER")).toBe("UPLOADED");
  });

  it("limits upload visibility choices by role", () => {
    expect(getUploadVisibilityOptions("OWNER")).toEqual([
      "OWNER_ONLY",
      "BRAND_TEAM",
      "CLIENT_REVIEW",
    ]);
    expect(getUploadVisibilityOptions("BRAND_SPECIALIST")).toEqual([
      "BRAND_TEAM",
    ]);
  });

  it("validates a Specialist upload and rejects unavailable visibility", () => {
    const file = new File(["hello"], "Customer Brief.pdf", {
      type: "application/pdf",
    });
    const valid = validateFileUploadFormData({
      formData: formData({ file, visibility: "BRAND_TEAM" }),
      role: "BRAND_SPECIALIST",
    });
    const invalid = validateFileUploadFormData({
      formData: formData({ file, visibility: "OWNER_ONLY" }),
      role: "BRAND_SPECIALIST",
    });

    expect(valid.error).toBeNull();
    expect(valid.data?.visibility).toBe("BRAND_TEAM");
    expect(invalid.error).toBe("This visibility is not available for this upload.");
  });

  it("sanitizes storage paths without making files public", () => {
    expect(sanitizeFileName("../Customer Strategy!!.pdf")).toBe(
      "Customer-Strategy.pdf",
    );
    expect(
      buildStoragePath({
        brandId: "brand-1",
        fileId: "file-1",
        originalName: "../Customer Strategy!!.pdf",
      }),
    ).toBe("brand-1/file-1/Customer-Strategy.pdf");
  });
});

describe("file permissions and audit metadata", () => {
  it("allows pending Specialist files only to Owner/Executive or uploader", () => {
    const pending = brandFile({
      status: "PENDING_OWNER_APPROVAL",
      uploadedBy: "specialist-1",
    });

    expect(
      canDownloadFile({
        file: pending,
        role: "OWNER",
        profileId: "owner-1",
      }),
    ).toBe(true);
    expect(
      canDownloadFile({
        file: pending,
        role: "BRAND_SPECIALIST",
        profileId: "specialist-1",
      }),
    ).toBe(true);
    expect(
      canDownloadFile({
        file: pending,
        role: "BRAND_SPECIALIST",
        profileId: "other-specialist",
      }),
    ).toBe(false);
  });

  it("keeps Owner-only files away from Brand Specialists", () => {
    const ownerOnly = brandFile({ visibility: "OWNER_ONLY" });

    expect(
      canDownloadFile({
        file: ownerOnly,
        role: "OWNER",
        profileId: "owner-1",
      }),
    ).toBe(true);
    expect(
      canDownloadFile({
        file: ownerOnly,
        role: "BRAND_SPECIALIST",
        profileId: "specialist-1",
      }),
    ).toBe(false);
  });

  it("allows Owner review only while a Specialist upload is pending", () => {
    expect(
      canReviewSpecialistFile({
        file: brandFile({ status: "PENDING_OWNER_APPROVAL" }),
        role: "OWNER",
      }),
    ).toBe(true);
    expect(
      canReviewSpecialistFile({
        file: brandFile({ status: "PENDING_OWNER_APPROVAL" }),
        role: "BRAND_SPECIALIST",
      }),
    ).toBe(false);
  });

  it("builds safe audit metadata without signed URLs", () => {
    const audit = toFileAuditMetadata(brandFile());
    const auditJson = JSON.stringify(audit);

    expect(audit).toMatchObject({
      file_id: "file-1",
      brand_id: "brand-1",
      storage_path: "brand-1/file-1/strategy.pdf",
    });
    expect(auditJson).not.toContain("signedUrl");
    expect(auditJson).not.toContain("token=");
  });
});

describe("file components", () => {
  it("renders the uploader for an Owner", () => {
    render(<FileUploader access={ownerAccess} />);

    expect(screen.getByRole("button", { name: "Upload file" })).toBeVisible();
    expect(screen.getByLabelText("File")).toBeVisible();
    expect(screen.getByLabelText("Visibility")).toBeVisible();
  });

  it("renders file list actions for pending Specialist uploads", () => {
    render(
      <FileList
        access={ownerAccess}
        files={[
          brandFile({
            status: "PENDING_OWNER_APPROVAL",
            uploadedBy: "specialist-1",
            uploadedByEmail: "specialist@example.com",
          }),
        ]}
        profileId="owner-1"
      />,
    );

    expect(screen.getByText("strategy.pdf")).toBeVisible();
    expect(screen.getByRole("button", { name: /Download/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Approve/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeVisible();
  });

  it("renders Specialist upload guidance", () => {
    render(<FileUploader access={specialistAccess} />);

    expect(
      screen.getByText(/held for Owner approval/),
    ).toBeVisible();
  });
});
