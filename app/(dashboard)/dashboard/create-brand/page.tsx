import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CreateBrandForm } from "@/features/brands/create-brand/components/CreateBrandForm";
import { getCreateBrandAccessKeyContext } from "@/features/brands/create-brand/services";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Create Brand | Bextudio Platform",
};

export const dynamic = "force-dynamic";

function readAccessKeyId(
  value: string | string[] | undefined,
): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default async function CreateBrandPage({
  searchParams,
}: {
  searchParams: Promise<{ access_key_id?: string | string[] }>;
}) {
  const params = await searchParams;
  const accessKeyId = readAccessKeyId(params.access_key_id);

  if (!accessKeyId) {
    redirect("/dashboard");
  }

  const { user, profile } = await requireUserProfile("/dashboard/create-brand");
  const contextResult = await getCreateBrandAccessKeyContext({
    accessKeyId,
    profileId: profile.id,
    userEmail: profile.email,
  });

  if (!contextResult.ok) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;
  const { accessKey, plan } = contextResult.context;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Activation verified
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Create Brand
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
          </p>
        </div>

        <CreateBrandForm
          accessKeyId={accessKey.id}
          keyPrefix={accessKey.keyPrefix}
          planName={plan?.name ?? null}
        />
      </section>
    </main>
  );
}
