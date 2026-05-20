import { DownloadIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  approveSpecialistFileAction,
  createSignedDownloadUrlAction,
  rejectSpecialistFileAction,
} from "@/features/files/actions";
import {
  canDownloadFile,
  canReviewSpecialistFile,
} from "@/features/files/schema";
import type {
  BrandFileRecord,
  FileAccessContext,
} from "@/features/files/types";
import { FileAccessBadge } from "@/features/files/components/FileAccessBadge";

function formatSize(sizeBytes: number | null) {
  if (!sizeBytes || sizeBytes <= 0) {
    return "Unknown size";
  }

  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function FileList({
  access,
  files,
  profileId,
}: {
  access: FileAccessContext;
  files: BrandFileRecord[];
  profileId: string;
}) {
  if (files.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            No files are available for this brand workspace yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Files</CardTitle>
        <CardDescription>
          Files are stored privately. Download creates a short-lived signed URL
          after permission validation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {files.map((file) => {
          const canDownload = canDownloadFile({
            file,
            role: access.membershipRole,
            profileId,
          });
          const canReview = canReviewSpecialistFile({
            file,
            role: access.membershipRole,
          });

          return (
            <div
              className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[1fr_auto]"
              key={file.id}
            >
              <div className="min-w-0 space-y-3">
                <div>
                  <h3 className="truncate text-sm font-medium">
                    {file.originalName}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatSize(file.sizeBytes)} | Uploaded{" "}
                    {formatDate(file.createdAt)}
                    {file.uploadedByEmail ? ` by ${file.uploadedByEmail}` : ""}
                  </p>
                </div>
                <FileAccessBadge
                  status={file.status}
                  visibility={file.visibility}
                />
              </div>

              <div className="flex flex-wrap items-start gap-2 md:justify-end">
                {canDownload ? (
                  <form action={createSignedDownloadUrlAction}>
                    <input name="file_id" type="hidden" value={file.id} />
                    <Button type="submit" variant="outline">
                      <DownloadIcon className="size-4" />
                      Download
                    </Button>
                  </form>
                ) : null}

                {canReview ? (
                  <>
                    <form action={approveSpecialistFileAction}>
                      <input name="file_id" type="hidden" value={file.id} />
                      <Button type="submit" variant="outline">
                        <ShieldCheckIcon className="size-4" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectSpecialistFileAction}>
                      <input name="file_id" type="hidden" value={file.id} />
                      <Button type="submit" variant="destructive">
                        <ShieldXIcon className="size-4" />
                        Reject
                      </Button>
                    </form>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
