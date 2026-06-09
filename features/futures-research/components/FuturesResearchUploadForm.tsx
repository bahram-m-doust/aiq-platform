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
import { uploadFuturesResearchReportAction } from "@/features/futures-research/actions";
import { initialFuturesResearchActionState } from "@/features/futures-research/schema";

export function FuturesResearchUploadForm({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    uploadFuturesResearchReportAction,
    initialFuturesResearchActionState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="size-4" />
          Upload futures research analysis
        </CardTitle>
        <CardDescription>
          Upload the futures research analysis PDF for a brand. It is sent
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
            <Label htmlFor="futures-research-brand">Brand</Label>
            <Select name="brand_id" required>
              <SelectTrigger className="w-full" id="futures-research-brand">
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
            <Label htmlFor="futures-research-file">Analysis PDF</Label>
            <Input
              accept=".pdf,application/pdf"
              id="futures-research-file"
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
