import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { AdminLoginForm } from "@/features/auth/components/AdminLoginForm";
import { sanitizeRedirectPath } from "@/features/auth/redirects";

export const metadata: Metadata = {
  title: "Admin sign in | Bextudio Platform",
};

const defaultAdminPath = "/admin";

function sanitizeAdminNext(value: string | undefined) {
  const path = sanitizeRedirectPath(value ?? null);
  if (path === "/dashboard") {
    return defaultAdminPath;
  }
  return path;
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <AdminLoginForm
        message={params.message}
        nextPath={sanitizeAdminNext(params.next)}
      />
    </AuthShell>
  );
}
