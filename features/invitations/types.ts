import type { AccessKeySafeRecord } from "@/features/access/types";

export type InvitationManagerRole = "OWNER" | "EXECUTIVE_MANAGER";

export type SpecialistInvitationContext = {
  brandId: string;
  brandName: string;
  membershipRole: InvitationManagerRole;
  planName: string | null;
};

export type SpecialistInvitationInput = {
  targetEmail: string;
  expiresAt: string;
};

export type SpecialistInvitationResult = {
  accessKey: AccessKeySafeRecord;
  invitationUrl: string | null;
  resendEmailId: string | null;
  warning?: string;
};

export type SpecialistInvitationFormState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | ({
      status: "success";
      message: string;
    } & SpecialistInvitationResult);

export type AcceptInvitationFormState = {
  status: "idle" | "error";
  message: string;
};

export type SpecialistMembershipRecord = {
  id: string;
  brandId: string;
  userId: string;
  role: "BRAND_SPECIALIST";
  status: "ACTIVE";
  invitedBy: string | null;
};
