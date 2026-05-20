import type { ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DashboardActivationCtas } from "@/components/dashboard/DashboardActivationCtas";
import { AccessKeyRedemptionForm } from "@/features/access/components/AccessKeyRedemptionForm";

const inactiveDashboardCopy =
  "Your strategic workspace is ready, but not yet activated. Activate access to begin the Brand Intelligence process and start building your Brand Brain.";

export function InactiveDashboardState({
  email,
  signOutAction,
}: {
  email: string;
  signOutAction: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Inactive Dashboard</CardTitle>
        <CardDescription>Signed in as {email}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-base leading-7 text-foreground">
            {inactiveDashboardCopy}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            Login verifies identity only. Brand workspace access requires an
            active brand membership and active entitlement.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <AccessKeyRedemptionForm />
          <DashboardActivationCtas />
        </div>
        {signOutAction}
      </CardContent>
    </Card>
  );
}
