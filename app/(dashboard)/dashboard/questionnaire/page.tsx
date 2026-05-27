import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { StrategicIntakeWorkspace } from "@/features/intake/components/StrategicIntakeWorkspace";
import { getIntakePageData } from "@/features/intake/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Questionnaire | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function QuestionnairePage() {
  const { user, profile } = await requireUserProfile(
    "/dashboard/questionnaire",
  );
  const data = await getIntakePageData({ profileId: profile.id });

  if (!data) {
    redirect("/dashboard");
  }

  const email = user.email ?? profile.email;

  return (
    <main className="min-h-svh bg-background px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Questionnaire
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">
            Brand Questionnaire
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {email}
          </p>
        </div>
        <StrategicIntakeWorkspace
          data={data}
          selectedSectionKey={data.sections[0]?.key ?? null}
        />
      </section>
    </main>
  );
}
