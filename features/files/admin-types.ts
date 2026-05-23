import type { FileUploadFormState } from "@/features/files/types";

export type AdminFileReviewState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialAdminFileUploadState: FileUploadFormState = {
  status: "idle",
  message: "",
};

export const initialAdminFileReviewState: AdminFileReviewState = {
  status: "idle",
  message: "",
};
