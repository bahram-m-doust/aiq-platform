import { validateEmail } from "@/features/auth/schemas";
import type {
  AdminAccessKeyFormInput,
  AdminAccessKeyFormState,
  AdminAccessKeyType,
  AdminAccessKeyCreatedResult,
  BrandRole,
} from "@/features/admin/types";
import { adminAccessKeyTypes, brandRoles } from "@/features/admin/types";

export const initialAdminAccessKeyFormState: AdminAccessKeyFormState = {
  status: "idle",
  message: "",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function readString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalId(formData: FormData, key: string) {
  const value = readString(formData, key);
  return value && value !== "none" ? value : null;
}

export function isAdminAccessKeyType(
  value: string,
): value is AdminAccessKeyType {
  return adminAccessKeyTypes.includes(value as AdminAccessKeyType);
}

export function isBrandRole(value: string): value is BrandRole {
  return brandRoles.includes(value as BrandRole);
}

export function requiresTargetBrand(type: AdminAccessKeyType) {
  return type === "CLAIM_BRAND" || type === "JOIN_BRAND";
}

export function allowsTargetBrand(type: AdminAccessKeyType) {
  return type === "CLAIM_BRAND" || type === "JOIN_BRAND" || type === "DEMO_ACCESS";
}

export function requiresTargetRole(type: AdminAccessKeyType) {
  return type === "CLAIM_BRAND" || type === "JOIN_BRAND";
}

export function allowsPlan(type: AdminAccessKeyType) {
  return type === "CREATE_BRAND" || type === "DEMO_ACCESS";
}

export function toEndOfDayUtcIso(dateValue: string) {
  if (!datePattern.test(dateValue)) {
    return null;
  }

  const expiresAt = new Date(`${dateValue}T23:59:59.999Z`);
  return Number.isNaN(expiresAt.getTime()) ? null : expiresAt.toISOString();
}

export function validateAdminAccessKeyFormData(formData: FormData): {
  data: AdminAccessKeyFormInput | null;
  error: string | null;
} {
  const typeValue = readString(formData, "type");

  if (!isAdminAccessKeyType(typeValue)) {
    return { data: null, error: "Choose a supported access key type." };
  }

  const targetEmail = readString(formData, "target_email").toLowerCase();

  if (!validateEmail(targetEmail)) {
    return { data: null, error: "Enter a valid target email address." };
  }

  const targetBrandId = allowsTargetBrand(typeValue)
    ? readOptionalId(formData, "target_brand_id")
    : null;

  if (requiresTargetBrand(typeValue) && !targetBrandId) {
    return { data: null, error: "Choose a target brand for this key type." };
  }

  const targetRoleValue = readString(formData, "target_role");
  const targetRole =
    requiresTargetRole(typeValue) && isBrandRole(targetRoleValue)
      ? targetRoleValue
      : null;

  if (requiresTargetRole(typeValue) && !targetRole) {
    return { data: null, error: "Choose a target role for this key type." };
  }

  const planId = allowsPlan(typeValue)
    ? readOptionalId(formData, "plan_id")
    : null;
  const expiresAt = toEndOfDayUtcIso(readString(formData, "expires_at"));

  if (!expiresAt) {
    return { data: null, error: "Choose a valid expiry date." };
  }

  if (Date.parse(expiresAt) <= Date.now()) {
    return { data: null, error: "Choose a future expiry date." };
  }

  return {
    data: {
      type: typeValue,
      targetEmail,
      targetBrandId,
      targetRole,
      planId,
      expiresAt,
      sendEmail: readString(formData, "send_email") === "true",
    },
    error: null,
  };
}

export function buildAdminAccessKeySuccessState({
  rawKey,
  accessKey,
  resendEmailId,
  warning,
}: AdminAccessKeyCreatedResult): AdminAccessKeyFormState {
  return {
    status: "success",
    message: warning
      ? "Access key created. Email delivery needs attention."
      : "Access key created.",
    rawKey,
    accessKey,
    resendEmailId,
    ...(warning ? { warning } : {}),
  };
}
