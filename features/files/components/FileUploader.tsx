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
import { uploadFileAction } from "@/features/files/actions";
import {
  defaultUploadVisibility,
  fileVisibilityLabels,
  getUploadVisibilityOptions,
  initialFileUploadFormState,
} from "@/features/files/schema";
import type { FileAccessContext } from "@/features/files/types";

export function FileUploader({ access }: { access: FileAccessContext }) {
  const [state, formAction] = useActionState(
    uploadFileAction,
    initialFileUploadFormState,
  );
  const visibilityOptions = getUploadVisibilityOptions(access.membershipRole);
  const defaultVisibility = defaultUploadVisibility(access.membershipRole);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadIcon className="size-4" />
          Upload file
        </CardTitle>
        <CardDescription>
          Store files in the private Bextudio bucket for {access.brandName}.
          Downloads always require a signed URL.
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

          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input id="file" name="file" required type="file" />
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
                      {fileVisibilityLabels[visibility]}
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
            <SubmitButton idleLabel="Upload file" pendingLabel="Uploading" />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
