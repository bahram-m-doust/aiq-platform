import type { GrantBrandAccessResult } from "@/features/access/types";

export type CreateBrandAccessKeyRecord = {
  id: string;
  keyPrefix: string;
  type: string;
  status: string;
  targetEmail: string | null;
  targetBrandId: string | null;
  planId: string | null;
  expiresAt: string;
  redeemedBy: string | null;
};

export type CreateBrandPlanRecord = {
  id: string;
  name: string;
  durationDays: number | null;
  includedModules: unknown;
};

export type CreateBrandAccessKeyContext = {
  accessKey: CreateBrandAccessKeyRecord;
  plan: CreateBrandPlanRecord | null;
};

export type CreateBrandContextResult =
  | {
      ok: true;
      context: CreateBrandAccessKeyContext;
    }
  | {
      ok: false;
      message: string;
    };

export type CreateBrandFormInput = {
  accessKeyId: string;
  brandName: string;
  industry: string;
  website: string | null;
};

export type CreateBrandFormState = {
  status: "idle" | "error";
  message: string;
};

export type CreatedBrandResult = {
  brandId: string;
  membershipId: string;
  intakeSessionId: string;
  entitlement: GrantBrandAccessResult | null;
  moduleCount: number;
};
