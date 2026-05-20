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
import {
  initialModuleUploadFormState,
  uploadModuleArtifactAction,
} from "@/features/modules/actions";
import type { ModuleRecord } from "@/features/modules/types";

export function ModuleArtifactUploadForm({
  module,
}: {
  module: ModuleRecord;
}) {
  const [state, formAction] = useActionState(
    uploadModuleArtifactAction,
    initialModuleUploadFormState,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="size-4" />
          Upload draft
        </CardTitle>
        <CardDescription>
          Upload an internal DOCX or PDF draft for {module.title}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          <input name="module_id" type="hidden" value={module.id} />
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
            <Label htmlFor="module-file">Draft file</Label>
            <Input
              accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              id="module-file"
              name="file"
              required
              type="file"
            />
          </div>
          <div className="flex justify-end">
            <SubmitButton idleLabel="Upload draft" pendingLabel="Uploading" />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
