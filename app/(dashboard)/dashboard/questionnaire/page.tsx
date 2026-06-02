import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuestionnaireLanding } from "@/features/intake/components/QuestionnaireLanding";
import { getIntakePageData } from "@/features/intake/queries";
import { requireUserProfile } from "@/features/auth/queries";

export const metadata: Metadata = {
  title: "Questionnaires | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function QuestionnairePage() {
  const { profile } = await requireUserProfile("/dashboard/questionnaire");
  const data = await getIntakePageData({ profileId: profile.id });

  if (!data) {
    redirect("/dashboard");
  }

  return <QuestionnaireLanding data={data} />;
}
