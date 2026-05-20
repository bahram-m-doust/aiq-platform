import type { AccessKeySafeRecord, AccessKeyType } from "@/features/access/types";

export const adminAccessKeyTypes = [
  "CREATE_BRAND",
  "CLAIM_BRAND",
  "JOIN_BRAND",
  "DEMO_ACCESS",
] as const satisfies readonly AccessKeyType[];

export type AdminAccessKeyType = (typeof adminAccessKeyTypes)[number];

export const brandRoles = [
  "OWNER",
  "EXECUTIVE_MANAGER",
  "BRAND_SPECIALIST",
] as const;

export type BrandRole = (typeof brandRoles)[number];

export type AdminPlanOption = {
  id: string;
  name: string;
};

export type AdminBrandOption = {
  id: string;
  name: string;
  status: string;
};

export type AdminAccessKeyFormOptions = {
  plans: AdminPlanOption[];
  brands: AdminBrandOption[];
};

export type AdminAccessKeyFormInput = {
  type: AdminAccessKeyType;
  targetEmail: string;
  targetBrandId: string | null;
  targetRole: BrandRole | null;
  planId: string | null;
  expiresAt: string;
  sendEmail: boolean;
};

export type AdminAccessKeyCreatedResult = {
  rawKey: string;
  accessKey: AccessKeySafeRecord;
  resendEmailId: string | null;
  warning?: string;
};

export type AdminAccessKeyFormState =
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
    } & AdminAccessKeyCreatedResult);
