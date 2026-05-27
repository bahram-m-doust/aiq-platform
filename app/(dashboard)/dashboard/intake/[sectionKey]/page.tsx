import { redirect } from "next/navigation";

export default async function IntakeSectionPage({
  params,
}: {
  params: Promise<{ sectionKey: string }>;
}) {
  const { sectionKey } = await params;
  redirect(`/dashboard/questionnaire/${sectionKey}`);
}
