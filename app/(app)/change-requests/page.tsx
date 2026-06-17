import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Change Requests | Bextudio Platform",
};

export const dynamic = "force-dynamic";

export default async function ChangeRequestsPage() {
  redirect("/integrated-brand-brain/roadmap/questionnaire");
}
