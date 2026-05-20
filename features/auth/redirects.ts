const defaultRedirectPath = "/dashboard";

export function sanitizeRedirectPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return defaultRedirectPath;
  }

  if (value.startsWith("//")) {
    return defaultRedirectPath;
  }

  return value;
}
