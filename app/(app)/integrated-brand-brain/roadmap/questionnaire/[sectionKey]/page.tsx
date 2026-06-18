import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import { SectionQuestionnaire } from "@/features/questionnaire/components/SectionQuestionnaire";
import { getIntakePageData } from "@/features/questionnaire/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { questionnaireSectionPath } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Questionnaire | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function QuestionnaireSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectionKey: string }>;
  searchParams: Promise<{ validate?: string }>;
}) {
  const { sectionKey } = await params;
  const { validate } = await searchParams;
  const { profile } = await requireUserProfile(
    questionnaireSectionPath(sectionKey),
  );
  const data = await getIntakePageData({ profileId: profile.id });

  if (!data) {
    redirect("/home");
  }

  const selectedSection = data.sections.find(
    (section) => section.key === sectionKey,
  );

  if (!selectedSection) {
    redirect("/home");
  }

  return (
    <>
      <SetBreadcrumbLabels
        labels={{
          [questionnaireSectionPath(sectionKey)]: selectedSection.title,
        }}
      />
      <SectionQuestionnaire
        allSections={data.sections}
        answers={data.answers}
        autoValidate={validate === "1"}
        brandName={data.access.brandName}
        completion={data.completion}
        latestSnapshotId={data.latestSnapshotId}
        section={selectedSection}
        session={data.session}
      />
    </>
  );
}
