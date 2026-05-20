export type BrandAccessStatus = "NO_ACCESS" | "ACTIVE_ACCESS";

export type BrandAccessSummary = {
  status: BrandAccessStatus;
  brandId: string | null;
  brandName: string | null;
  membershipRole: string | null;
  planName: string | null;
};

export type AccessKeyRedemptionFormState = {
  status: "idle" | "error";
  message: string;
};

export const initialAccessKeyRedemptionFormState: AccessKeyRedemptionFormState =
  {
    status: "idle",
    message: "",
  };

export type BrandAccessMembership = {
  brandId: string;
  brandName: string;
  role: string;
};

export type BrandAccessEntitlement = {
  brandId: string;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  planName: string | null;
};

export const entitlementSources = [
  "STRIPE",
  "ACCESS_KEY",
  "MANUAL_CASH",
  "BANK_TRANSFER",
  "DEMO",
  "PROMO",
  "INTERNAL",
] as const;

export type EntitlementSource = (typeof entitlementSources)[number];

export const agentEntitlementStatuses = [
  "LOCKED_BY_PLAN",
  "LOCKED_BY_BRAIN",
  "AVAILABLE",
  "ACTIVE",
  "SUSPENDED",
] as const;

export type AgentEntitlementStatus =
  (typeof agentEntitlementStatuses)[number];

export type GrantBrandAccessInput = {
  brandId: string;
  planId: string;
  source: EntitlementSource;
  startsAt: Date | string;
  expiresAt?: Date | string | null;
  grantedByUserId: string;
  actorRole?: string | null;
  manualReference?: string | null;
  internalNote?: string | null;
};

export type BrandEntitlementRecord = {
  id: string;
  brandId: string;
  planId: string;
  source: EntitlementSource;
  status: "ACTIVE";
  startsAt: string;
  expiresAt: string | null;
  grantedBy: string | null;
  manualReference: string | null;
  internalNote: string | null;
  createdAt: string | null;
};

export type GrantBrandAccessResult = {
  entitlement: BrandEntitlementRecord;
  includedAgentKeys: string[];
  matchedAgentKeys: string[];
  unmatchedAgentKeys: string[];
  agentEntitlementCount: number;
};

export const accessKeyTypes = [
  "CREATE_BRAND",
  "CLAIM_BRAND",
  "JOIN_BRAND",
  "DEMO_ACCESS",
  "SUPPORT_ACCESS",
] as const;

export type AccessKeyType = (typeof accessKeyTypes)[number];

export const accessKeyStatuses = [
  "ACTIVE",
  "REDEEMED",
  "EXPIRED",
  "REVOKED",
] as const;

export type AccessKeyStatus = (typeof accessKeyStatuses)[number];

export type AccessKeyFailureCode =
  | "MISSING_KEY"
  | "INVALID_KEY"
  | "INVALID_KEY_STATUS"
  | "EXPIRED_KEY"
  | "REVOKED_KEY"
  | "ALREADY_REDEEMED"
  | "EMAIL_MISMATCH"
  | "UNSUPPORTED_KEY_TYPE"
  | "INVALID_KEY_CONFIGURATION"
  | "CLAIM_BRAND_NOT_AVAILABLE"
  | "JOIN_BRAND_NOT_AVAILABLE"
  | "REDEMPTION_CONFLICT"
  | "STORAGE_ERROR";

export type AccessKeySafeRecord = {
  id: string;
  keyPrefix: string;
  type: AccessKeyType;
  status: AccessKeyStatus;
  targetEmail: string | null;
  targetBrandId: string | null;
  targetRole: string | null;
  planId: string | null;
  maxRedemptions: number;
  redeemedCount: number;
  expiresAt: string;
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdBy: string | null;
  createdAt: string | null;
  resendEmailId: string | null;
};

export type AccessKeyNextAction =
  | {
      kind: "CREATE_BRAND_REQUIRED";
      accessKeyId: string;
      keyType: "CREATE_BRAND";
      planId: string | null;
    }
  | {
      kind: "CLAIM_BRAND_REQUIRED";
      accessKeyId: string;
      keyType: "CLAIM_BRAND";
      targetBrandId: string;
      targetRole: string | null;
      planId: string | null;
    }
  | {
      kind: "JOIN_BRAND_REQUIRED";
      accessKeyId: string;
      keyType: "JOIN_BRAND";
      targetBrandId: string;
      targetRole: string | null;
      planId: string | null;
    }
  | {
      kind: "DEMO_ACCESS_CONTINUE";
      accessKeyId: string;
      keyType: "DEMO_ACCESS";
      targetBrandId: string | null;
      targetRole: string | null;
      planId: string | null;
    }
  | {
      kind: "SUPPORT_ACCESS_CONTINUE";
      accessKeyId: string;
      keyType: "SUPPORT_ACCESS";
      targetBrandId: string;
      targetRole: string | null;
      planId: string | null;
    };

export type RedeemAccessKeySuccess = {
  ok: true;
  accessKey: AccessKeySafeRecord;
  nextAction: AccessKeyNextAction;
};

export type RedeemAccessKeyFailure = {
  ok: false;
  code: AccessKeyFailureCode;
  message: string;
};

export type RedeemAccessKeyResult =
  | RedeemAccessKeySuccess
  | RedeemAccessKeyFailure;

export type CreateAccessKeyInput = {
  type: AccessKeyType;
  expiresAt: Date | string;
  createdByUserId: string;
  actorRole?: string | null;
  targetEmail?: string | null;
  targetBrandId?: string | null;
  targetRole?: string | null;
  planId?: string | null;
  maxRedemptions?: number | null;
};

export type CreateAccessKeyResult = {
  rawKey: string;
  accessKey: AccessKeySafeRecord;
};
