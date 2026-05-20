import type {
  AccessKeySafeRecord,
  RedeemAccessKeyFailure,
} from "@/features/access/types";

export type ClaimBrandRecord = {
  id: string;
  name: string;
  status: string;
};

export type ClaimBrandEntitlementRecord = {
  id: string;
  brandId: string;
  planId: string;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
};

export type ClaimBrandMembershipRecord = {
  id: string;
  brandId: string;
  userId: string;
  role: "OWNER";
  status: "ACTIVE";
};

export type ClaimBrandResult = {
  brand: ClaimBrandRecord;
  membership: ClaimBrandMembershipRecord;
};

export type ClaimBrandPreRedemptionInput = {
  accessKey: AccessKeySafeRecord;
  userId: string;
  userEmail: string;
  now: Date;
};

export type ClaimBrandPreRedemptionResult =
  Promise<RedeemAccessKeyFailure | null>;
