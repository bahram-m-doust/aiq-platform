import type { DocumentUploadFormState } from "@/features/documents/types";

export type AdminDocumentReviewState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialAdminDocumentUploadState: DocumentUploadFormState = {
  status: "idle",
  message: "",
};

export const initialAdminDocumentReviewState: AdminDocumentReviewState = {
  status: "idle",
  message: "",
};
