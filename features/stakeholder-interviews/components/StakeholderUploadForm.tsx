"use client";

import { useActionState } from "react";
import { UploadIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import { uploadStakeholderReportAction } from "@/features/stakeholder-interviews/actions";
import { initialStakeholderActionState } from "@/features/stakeholder-interviews/schema";

export function StakeholderUploadForm({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    uploadStakeholderReportAction,
    initialStakeholderActionState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="size-4" />
          Upload interview analysis
        </CardTitle>
        <CardDescription>
          Upload the stakeholder-interview analysis PDF for a brand. It is sent
          straight to the client for review.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "success" ? (
            <Alert>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="stakeholder-brand">Brand</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              id="stakeholder-brand"
              name="brand_id"
              required
            >
              <option className="bg-background text-foreground" value="">
                Select a brand…
              </option>
              {brands.map((brand) => (
                <option
                  className="bg-background text-foreground"
                  key={brand.id}
                  value={brand.id}
                >
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stakeholder-file">Analysis PDF</Label>
            <Input
              accept=".pdf,application/pdf"
              id="stakeholder-file"
              name="file"
              required
              type="file"
            />
          </div>

          <SubmitButton
            idleLabel="Upload & send for review"
            pendingLabel="Uploading…"
          />
        </form>
      </CardContent>
    </Card>
  );
}
