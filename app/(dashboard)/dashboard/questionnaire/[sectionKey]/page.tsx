import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetBreadcrumbLabels } from "@/components/dashboard/breadcrumb-labels";
import { SectionQuestionnaire } from "@/features/intake/components/SectionQuestionnaire";
import { getIntakePageData } from "@/features/intake/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { calculateIntakeCompletion } from "@/features/intake/schemas";

export const metadata: Metadata = {
  title: "Questionnaire | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function QuestionnaireSectionPage({
  params,
}: {
  params: Promise<{ sectionKey: string }>;
}) {
  const { sectionKey } = await params;
  const { profile } = await requireUserProfile(
    `/dashboard/questionnaire/${sectionKey}`,
  );
  const data = await getIntakePageData({ profileId: profile.id });

  if (!data) {
    redirect("/dashboard");
  }

  const selectedSection = data.sections.find(
    (section) => section.key === sectionKey,
  );

  if (!selectedSection) {
    redirect("/dashboard");
  }

  return (
    <>
      <SetBreadcrumbLabels
        labels={{
          [`/dashboard/questionnaire/${sectionKey}`]: selectedSection.title,
        }}
      />
      <SectionQuestionnaire
        allSections={data.sections}
        answers={data.answers}
        brandName={data.access.brandName}
        completion={data.completion}
        section={selectedSection}
        session={data.session}
      />
    </>
  );
}
