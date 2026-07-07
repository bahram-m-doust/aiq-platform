import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Change Requests | AIQ Platform",
};

export const dynamic = "force-dynamic";

export default async function ChangeRequestsPage() {
  redirect(ROUTES.questionnaire);
}
