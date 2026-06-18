import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { QuestionnaireLanding } from "@/features/questionnaire/components/QuestionnaireLanding";
import { getIntakePageData } from "@/features/questionnaire/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Questionnaires | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string }>;
}) {
  const { review } = await searchParams;
  const { profile } = await requireUserProfile(ROUTES.questionnaire);
  const data = await getIntakePageData({ profileId: profile.id });

  if (!data) {
    redirect("/home");
  }

  return <QuestionnaireLanding data={data} showSubmitReview={review === "1"} />;
}
