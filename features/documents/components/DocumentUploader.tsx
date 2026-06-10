"use client";

import { useActionState } from "react";
import { UploadIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
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
import { uploadDocumentAction } from "@/features/documents/actions";
import {
  defaultUploadVisibility,
  documentVisibilityLabels,
  getUploadVisibilityOptions,
  initialDocumentUploadFormState,
} from "@/features/documents/schema";
import type { DocumentAccessContext } from "@/features/documents/types";

export function DocumentUploader({ access }: { access: DocumentAccessContext }) {
  const [state, formAction] = useActionState(
    uploadDocumentAction,
    initialDocumentUploadFormState,
  );
  const visibilityOptions = getUploadVisibilityOptions(access.membershipRole);
  const defaultVisibility = defaultUploadVisibility(access.membershipRole);

  return (
    <DSCard>
      <DSCardHeader>
        <h2 className="ds-h2 flex items-center gap-2">
          <UploadIcon className="size-4" />
          Upload document
        </h2>
        <p className="ds-body mt-1">
          Store documents securely for {access.brandName}. Downloads always require a signed URL.
        </p>
      </DSCardHeader>
      <DSCardBody>
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

          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <div className="space-y-2">
              <Label htmlFor="file">Document</Label>
              <Input
                accept=".pdf,.docx,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"
                id="file"
                name="file"
                required
                type="file"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select defaultValue={defaultVisibility} name="visibility">
                <SelectTrigger id="visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibilityOptions.map((visibility) => (
                    <SelectItem key={visibility} value={visibility}>
                      {documentVisibilityLabels[visibility]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {access.membershipRole === "BRAND_SPECIALIST" ? (
            <p className="text-sm text-muted-foreground">
              Brand Specialist uploads are held for Owner approval before they
              become broadly available to the brand team.
            </p>
          ) : null}

          <div className="flex justify-end">
            <SubmitButton idleLabel="Upload document" pendingLabel="Uploading" />
          </div>
        </form>
      </DSCardBody>
    </DSCard>
  );
}
