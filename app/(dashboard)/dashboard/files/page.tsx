import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireUserProfile } from "@/features/auth/queries";
import { FileList } from "@/features/files/components/FileList";
import { FileUploader } from "@/features/files/components/FileUploader";
import { getBrandFilesWorkspace } from "@/features/files/queries";

export const metadata: Metadata = {
  title: "Files | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function DashboardFilesPage() {
  const { user, profile } = await requireUserProfile("/dashboard/files");
  const workspace = await getBrandFilesWorkspace(profile.id);

  if (!workspace) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Secure Files
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brand File Workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
          </p>
        </div>

        <FileUploader access={workspace.access} />
        <FileList
          access={workspace.access}
          files={workspace.files}
          profileId={profile.id}
        />

        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </section>
    </main>
  );
}
