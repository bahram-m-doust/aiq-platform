const defaultRedirectPath = "/home";
const adminLoginPath = "/admin/login";
const userLoginPath = "/login";
const internalRedirectOrigin = "https://bextudio.internal";

function hasControlCharacter(value: string) {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function sanitizeRedirectPath(value: FormDataEntryValue | string | null) {
  if (typeof value !== "string") {
    return defaultRedirectPath;
  }

  const target = value.trim();

  if (
    target !== value ||
    !target.startsWith("/") ||
    target.startsWith("//") ||
    target.includes("\\") ||
    hasControlCharacter(target)
  ) {
    return defaultRedirectPath;
  }

  try {
    const parsed = new URL(target, internalRedirectOrigin);

    if (parsed.origin !== internalRedirectOrigin) {
      return defaultRedirectPath;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return defaultRedirectPath;
  }
}

export function isAdminPath(value: string) {
  return value === "/admin" || value.startsWith("/admin/");
}

export function resolveLoginPathForNext(nextPath: string) {
  return isAdminPath(nextPath) && nextPath !== adminLoginPath
    ? adminLoginPath
    : userLoginPath;
}
