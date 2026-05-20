const defaultRedirectPath = "/dashboard";
const adminLoginPath = "/admin/login";
const userLoginPath = "/login";

export function sanitizeRedirectPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return defaultRedirectPath;
  }

  if (value.startsWith("//")) {
    return defaultRedirectPath;
  }

  return value;
}

export function isAdminPath(value: string) {
  return value === "/admin" || value.startsWith("/admin/");
}

export function resolveLoginPathForNext(nextPath: string) {
  return isAdminPath(nextPath) && nextPath !== adminLoginPath
    ? adminLoginPath
    : userLoginPath;
}
