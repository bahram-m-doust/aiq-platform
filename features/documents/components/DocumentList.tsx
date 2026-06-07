import { DownloadIcon, FileIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import {
  approveSpecialistDocumentAction,
  createSignedDownloadUrlAction,
  rejectSpecialistDocumentAction,
} from "@/features/documents/actions";
import {
  canDownloadDocument,
  canReviewSpecialistDocument,
} from "@/features/documents/schema";
import type {
  BrandDocumentRecord,
  DocumentAccessContext,
} from "@/features/documents/types";
import { DocumentAccessBadge } from "@/features/documents/components/DocumentAccessBadge";

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

export function DocumentList({
  access,
  files,
  profileId,
}: {
  access: DocumentAccessContext;
  files: BrandDocumentRecord[];
  profileId: string;
}) {
  if (files.length === 0) {
    return (
      <DSCard tone="soft">
        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <div
            className="flex size-14 items-center justify-center rounded-2xl"
            style={{
              background:
                "linear-gradient(135deg, var(--bv-brand-tint-16), var(--bv-brand-tint-8))",
              color: "var(--bv-brand-deep)",
              boxShadow: "0 0 0 1px var(--bv-brand-tint-16)",
            }}
          >
            <FileIcon className="size-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="ds-h3">No documents yet</h2>
            <p className="ds-body max-w-md mx-auto">
              Upload your first document using the form above. All documents are stored privately.
            </p>
          </div>
        </div>
      </DSCard>
    );
  }

  return (
    <DSCard>
      <DSCardHeader>
        <h2 className="ds-h2">Documents</h2>
        <p className="ds-body mt-1">
          Files are stored privately. Download creates a short-lived signed URL.
        </p>
      </DSCardHeader>
      <DSCardBody className="space-y-4">
        {files.map((file) => {
          const canDownload = canDownloadDocument({
            file,
            role: access.membershipRole,
            profileId,
          });
          const canReview = canReviewSpecialistDocument({
            file,
            role: access.membershipRole,
          });

          return (
            <div
              className="grid gap-4 rounded-[14px] border p-4 md:grid-cols-[1fr_auto]"
              key={file.id}
              style={{ borderColor: "var(--bv-line)", background: "var(--bv-card-soft)" }}
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
                <DocumentAccessBadge
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
                    <form action={approveSpecialistDocumentAction}>
                      <input name="file_id" type="hidden" value={file.id} />
                      <Button type="submit" variant="outline">
                        <ShieldCheckIcon className="size-4" />
                        Approve
                      </Button>
                    </form>
                    <form action={rejectSpecialistDocumentAction}>
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
      </DSCardBody>
    </DSCard>
  );
}
