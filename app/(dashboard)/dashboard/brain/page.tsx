import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BrainChat } from "@/features/agents/brain/components/BrainChat";
import { BrainLockedState } from "@/features/agents/brain/components/BrainLockedState";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Brand Brain | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function BrandBrainPage() {
  const { user, profile } = await requireUserProfile("/dashboard/brain");
  const workspace = await getBrandBrainWorkspace(profile.id);
  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-6xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Brand Integrator Brain
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brand Brain
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
            {workspace.access ? ` | ${workspace.access.brandName}` : ""}
          </p>
        </div>

        {workspace.readiness.isReady && workspace.access ? (
          <BrainChat access={workspace.access} />
        ) : (
          <BrainLockedState
            access={workspace.access}
            readiness={workspace.readiness}
          />
        )}

        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
