import type {
  ManualGrantFormInput,
  ManualGrantFormState,
  ManualGrantSource,
} from "@/features/admin/manual-grant/types";
import { manualGrantSources } from "@/features/admin/manual-grant/types";

export const initialManualGrantFormState: ManualGrantFormState = {
  status: "idle",
  message: "",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: string) {
  return value.length > 0 ? value : null;
}

export function isManualGrantSource(
  value: string,
): value is ManualGrantSource {
  return manualGrantSources.includes(value as ManualGrantSource);
}

export function toStartOfDayUtcIso(dateValue: string) {
  if (!datePattern.test(dateValue)) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toEndOfDayUtcIso(dateValue: string) {
  if (!datePattern.test(dateValue)) {
    return null;
  }

  const date = new Date(`${dateValue}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function validateManualGrantFormData(formData: FormData): {
  data: ManualGrantFormInput | null;
  error: string | null;
} {
  const brandId = readString(formData, "brand_id");

  if (!brandId) {
    return { data: null, error: "Choose a brand." };
  }

  const planId = readString(formData, "plan_id");

  if (!planId) {
    return { data: null, error: "Choose a plan." };
  }

  const source = readString(formData, "source");

  if (!isManualGrantSource(source)) {
    return { data: null, error: "Choose a supported grant source." };
  }

  const startsAt = toStartOfDayUtcIso(readString(formData, "starts_at"));

  if (!startsAt) {
    return { data: null, error: "Choose a valid start date." };
  }

  const expiresAt = toEndOfDayUtcIso(readString(formData, "expires_at"));

  if (!expiresAt) {
    return { data: null, error: "Choose a valid expiry date." };
  }

  if (Date.parse(expiresAt) <= Date.parse(startsAt)) {
    return { data: null, error: "Expiry date must be after start date." };
  }

  return {
    data: {
      brandId,
      planId,
      source,
      startsAt,
      expiresAt,
      manualReference: normalizeOptionalText(
        readString(formData, "manual_reference"),
      ),
      internalNote: normalizeOptionalText(readString(formData, "internal_note")),
    },
    error: null,
  };
}
