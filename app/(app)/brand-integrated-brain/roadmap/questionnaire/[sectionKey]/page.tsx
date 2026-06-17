import { redirect } from "next/navigation";

import { questionnaireSectionPath } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function LegacyQuestionnaireSectionPage({
  params,
}: {
  params: Promise<{ sectionKey: string }>;
}) {
  const { sectionKey } = await params;
  redirect(questionnaireSectionPath(sectionKey));
}