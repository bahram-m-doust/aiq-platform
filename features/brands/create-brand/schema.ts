import { normalizeAccessKeyEmail } from "@/features/access/access-key-rules";
import type {
  CreateBrandAccessKeyRecord,
  CreateBrandFormInput,
  CreateBrandFormState,
} from "@/features/brands/create-brand/types";

export const initialCreateBrandFormState: CreateBrandFormState = {
  status: "idle",
  message: "",
};

export type BrandModuleInsert = {
  brand_id: string;
  module_type: string;
  title: string;
  status: "NOT_STARTED";
};

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeWebsite(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function validateCreateBrandFormData(formData: FormData): {
  data: CreateBrandFormInput | null;
  error: string | null;
} {
  const accessKeyId = readString(formData, "access_key_id");

  if (!accessKeyId) {
    return { data: null, error: "Access key confirmation is missing." };
  }

  const brandName = readString(formData, "brand_name");

  if (!brandName) {
    return { data: null, error: "Enter the brand name." };
  }

  const industry = readString(formData, "industry");

  if (!industry) {
    return { data: null, error: "Enter the industry." };
  }

  const websiteInput = readString(formData, "website");
  const website = normalizeWebsite(websiteInput);

  if (websiteInput && !website) {
    return {
      data: null,
      error: "Website must be a valid http or https URL.",
    };
  }

  return {
    data: {
      accessKeyId,
      brandName,
      industry,
      website,
    },
    error: null,
  };
}

export function validateCreateBrandAccessKeyContext({
  accessKey,
  profileId,
  userEmail,
  now = new Date(),
}: {
  accessKey: CreateBrandAccessKeyRecord;
  profileId: string;
  userEmail: string;
  now?: Date;
}) {
  if (accessKey.type !== "CREATE_BRAND") {
    return "This access key cannot create a brand.";
  }

  if (accessKey.status !== "REDEEMED") {
    return "Redeem a CREATE_BRAND access key before creating a brand.";
  }

  if (accessKey.redeemedBy !== profileId) {
    return "This access key was redeemed by another user.";
  }

  if (accessKey.targetBrandId) {
    return "This CREATE_BRAND key has already been used to create a brand.";
  }

  const expiresAt = Date.parse(accessKey.expiresAt);

  if (Number.isNaN(expiresAt) || expiresAt <= now.getTime()) {
    return "This access key has expired.";
  }

  if (
    accessKey.targetEmail &&
    normalizeAccessKeyEmail(accessKey.targetEmail) !==
      normalizeAccessKeyEmail(userEmail)
  ) {
    return "This access key is assigned to another email address.";
  }

  return null;
}

export function calculatePlanGrantExpiresAt(
  startsAt: string,
  durationDays: number | null | undefined,
) {
  if (!durationDays || durationDays <= 0) {
    return null;
  }

  const startsAtTime = Date.parse(startsAt);

  if (Number.isNaN(startsAtTime)) {
    throw new Error("Plan grant start timestamp is invalid.");
  }

  return new Date(startsAtTime + durationDays * 24 * 60 * 60 * 1000)
    .toISOString();
}

export function parseIncludedModuleTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function buildBrandModuleRows({
  brandId,
  moduleTypes,
}: {
  brandId: string;
  moduleTypes: string[];
}): BrandModuleInsert[] {
  return moduleTypes.map((moduleType) => ({
    brand_id: brandId,
    module_type: moduleType,
    title: moduleType,
    status: "NOT_STARTED",
  }));
}
