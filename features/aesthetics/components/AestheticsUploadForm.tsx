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
import { uploadAestheticsDeliverableAction } from "@/features/aesthetics/actions";
import { initialAestheticsActionState } from "@/features/aesthetics/schema";

const KIND_OPTIONS = [
  { value: "VISUAL_DIRECTION", label: "Visual Direction" },
  { value: "COLOR_TYPE_SYSTEM", label: "Color & Type System" },
  { value: "ASSET_LIBRARY", label: "Asset Library" },
];

export function AestheticsUploadForm({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    uploadAestheticsDeliverableAction,
    initialAestheticsActionState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="size-4" />
          Upload aesthetics deliverable
        </CardTitle>
        <CardDescription>
          Upload a PDF for one of the three aesthetics deliverables. Uploading
          sends it to the client for review and approval.
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
            <Label htmlFor="aesthetics-brand">Brand</Label>
            <Select name="brand_id" required>
              <SelectTrigger className="w-full" id="aesthetics-brand">
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
            <Label htmlFor="aesthetics-kind">Deliverable</Label>
            <Select name="kind" required>
              <SelectTrigger className="w-full" id="aesthetics-kind">
                <SelectValue placeholder="Select a deliverable…" />
              </SelectTrigger>
              <SelectContent className="dark">
                {KIND_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="aesthetics-file">PDF file</Label>
            <Input
              accept=".pdf,application/pdf"
              id="aesthetics-file"
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
