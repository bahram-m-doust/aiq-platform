import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SetBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import { SectionQuestionnaire } from "@/features/questionnaire/components/SectionQuestionnaire";
import { getIntakePageData } from "@/features/questionnaire/queries";
import { requireUserProfile } from "@/features/auth/queries";
import { questionnaireSectionPath } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Questionnaire | AIQ Platform",
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
    redirect("/");
  }

  // URLs use the lowercased section key (questionnaireSectionPath), but the
  // stable key stored on the section is upper-case — match case-insensitively
  // so both the new lowercase links and any old upper-case bookmarks resolve.
  const selectedSection = data.sections.find(
    (section) => section.key.toLowerCase() === sectionKey.toLowerCase(),
  );

  if (!selectedSection) {
    redirect("/");
  }

  return (
    <>
      <SetBreadcrumbLabels
        labels={Object.fromEntries(
          data.sections.map((section) => [
            questionnaireSectionPath(section.key),
            section.title,
          ]),
        )}
      />
      <SectionQuestionnaire
        allSections={data.sections}
        answers={data.answers}
        autoValidate={validate === "1"}
        brandName={data.access.brandName}
        completion={data.completion}
        markedDoneQuestionIds={data.markedDoneQuestionIds}
        section={selectedSection}
        session={data.session}
      />
    </>
  );
}
