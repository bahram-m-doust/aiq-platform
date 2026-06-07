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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
            <Select name="brand_id" required>
              <SelectTrigger className="w-full" id="stakeholder-brand">
                <SelectValue placeholder="Select a brand…" />
              </SelectTrigger>
              <SelectContent className="dark">
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
