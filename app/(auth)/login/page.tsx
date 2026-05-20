import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { sanitizeRedirectPath } from "@/features/auth/redirects";

export const metadata: Metadata = {
  title: "Sign in | Bextudio Platform",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <LoginForm
        message={params.message}
        nextPath={sanitizeRedirectPath(params.next ?? null)}
      />
    </AuthShell>
  );
}
