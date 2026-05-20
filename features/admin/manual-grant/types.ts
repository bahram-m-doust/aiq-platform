import type {
  EntitlementSource,
  GrantBrandAccessResult,
} from "@/features/access/types";
import type { AdminAccessKeyFormOptions } from "@/features/admin/types";

export const manualGrantSources = [
  "MANUAL_CASH",
  "BANK_TRANSFER",
  "DEMO",
  "PROMO",
  "INTERNAL",
] as const satisfies readonly EntitlementSource[];

export type ManualGrantSource = (typeof manualGrantSources)[number];

export type ManualGrantFormOptions = AdminAccessKeyFormOptions;

export type ManualGrantFormInput = {
  brandId: string;
  planId: string;
  source: ManualGrantSource;
  startsAt: string;
  expiresAt: string;
  manualReference: string | null;
  internalNote: string | null;
};

export type ManualGrantFormState =
  | {
      status: "idle";
      message: string;
    }
  | {
      status: "error";
      message: string;
    }
  | {
      status: "success";
      message: string;
      grant: GrantBrandAccessResult;
      warning?: string;
    };
