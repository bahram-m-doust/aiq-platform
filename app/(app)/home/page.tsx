import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/routes";

export default async function LegacyHomePage() {
  redirect(ROUTES.home);
}
