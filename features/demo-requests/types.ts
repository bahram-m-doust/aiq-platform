export const demoRequestStatuses = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
] as const;

export type DemoRequestStatus = (typeof demoRequestStatuses)[number];

export type DemoRequestRecord = {
  id: string;
  userId: string | null;
  email: string;
  message: string | null;
  status: DemoRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  resolutionNote: string | null;
  approvedAccessKeyId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreateDemoRequestInput = {
  message: string | null;
};

export type CreateDemoRequestFormState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export type ReviewDemoRequestFormState =
  | { status: "idle"; message: string }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

export const initialCreateDemoRequestFormState: CreateDemoRequestFormState = {
  status: "idle",
  message: "",
};

export const initialReviewDemoRequestFormState: ReviewDemoRequestFormState = {
  status: "idle",
  message: "",
};
