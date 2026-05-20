import type { Metadata } from "next";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { sanitizeRedirectPath } from "@/features/auth/redirects";

export const metadata: Metadata = {
  title: "Register | Bextudio Platform",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthShell>
      <RegisterForm nextPath={sanitizeRedirectPath(params.next ?? null)} />
    </AuthShell>
  );
}
