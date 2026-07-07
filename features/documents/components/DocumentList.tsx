"use client";

import { useMemo, useState } from "react";
import {
  DownloadIcon,
  FileTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldXIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
    timeZone: "UTC",
  }).format(new Date(value));
}

function initials(value: string | null) {
  const fallback = "AI";
  if (!value) return fallback;

  const parts = value
    .split(/[\s@._-]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (parts[0]?.[0] ?? "A").concat(parts[1]?.[0] ?? "I").toUpperCase();
}

function uploaderName(file: BrandDocumentRecord) {
  return file.uploaderLabel || file.uploadedByEmail || "AIQ STUDIO";
}

function FileActions({
  canDownload,
  canReview,
  file,
}: {
  canDownload: boolean;
  canReview: boolean;
  file: BrandDocumentRecord;
}) {
  if (!canDownload && !canReview) {
    return (
      <span className="text-sm font-normal leading-5 text-muted-foreground">
        -
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canDownload ? (
        <form action={createSignedDownloadUrlAction}>
          <input name="file_id" type="hidden" value={file.id} />
          <Button size="sm" type="submit" variant="outline">
            <DownloadIcon className="size-4" />
            Download
          </Button>
        </form>
      ) : null}

      {canReview ? (
        <>
          <form action={approveSpecialistDocumentAction}>
            <input name="file_id" type="hidden" value={file.id} />
            <Button size="sm" type="submit" variant="outline">
              <ShieldCheckIcon className="size-4" />
              Approve
            </Button>
          </form>
          <form action={rejectSpecialistDocumentAction}>
            <input name="file_id" type="hidden" value={file.id} />
            <Button size="sm" type="submit" variant="destructive">
              <ShieldXIcon className="size-4" />
              Reject
            </Button>
          </form>
        </>
      ) : null}
    </div>
  );
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
  const [query, setQuery] = useState("");

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return files.filter((file) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        file.originalName,
        file.uploaderLabel,
        file.uploadedByEmail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [files, query]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <h2 className="text-xl font-semibold leading-7 text-foreground">
            Attached files
          </h2>
          <p className="max-w-xl text-sm font-normal leading-5 text-muted-foreground">
            Files and assets that have been attached to this workspace.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-72">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search documents"
              className="h-9 pl-9 text-sm font-normal leading-5 shadow-xs"
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Search"
              value={query}
            />
          </div>
        </div>
      </div>

      <Card className="gap-0 overflow-hidden py-0 shadow-xs">
        <CardContent className="p-0">
          {files.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
                <FileTextIcon className="size-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-medium leading-6">
                  No documents yet
                </h3>
                <p className="mx-auto max-w-md text-sm font-normal leading-5 text-muted-foreground">
                  Upload your first document using the dropzone above. All
                  documents are stored privately.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[780px]">
                <div className="grid grid-cols-[minmax(260px,1.6fr)_120px_150px_minmax(180px,1fr)_132px] items-center gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-medium leading-4 text-muted-foreground">
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true" className="size-10 shrink-0" />
                    <span>File name</span>
                  </span>
                  <span>File size</span>
                  <span>Date uploaded</span>
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className="size-8 shrink-0" />
                    <span>Uploaded by</span>
                  </span>
                  <span aria-hidden="true" />
                </div>

                {visibleFiles.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm font-normal leading-5 text-muted-foreground">
                    No files match this view.
                  </div>
                ) : (
                  visibleFiles.map((file) => {
                    const canDownload = canDownloadDocument({
                      file,
                      role: access.membershipRole,
                      profileId,
                    });
                    const canReview = canReviewSpecialistDocument({
                      file,
                      role: access.membershipRole,
                    });
                    const uploader = uploaderName(file);

                    return (
                      <div
                        className="grid grid-cols-[minmax(260px,1.6fr)_120px_150px_minmax(180px,1fr)_132px] items-center gap-4 border-b px-4 py-4 last:border-b-0"
                        key={file.id}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600">
                            <FileTextIcon className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-5 text-foreground">
                              {file.originalName}
                            </p>
                            {file.mimeType ? (
                              <p className="mt-0.5 truncate text-sm font-normal leading-5 text-muted-foreground">
                                {file.mimeType}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <span className="text-sm font-normal leading-5 text-muted-foreground">
                          {formatSize(file.sizeBytes)}
                        </span>
                        <span className="text-sm font-normal leading-5 text-muted-foreground">
                          {formatDate(file.createdAt)}
                        </span>

                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                            {initials(uploader)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-5 text-foreground">
                              {uploader}
                            </p>
                            {file.uploadedByEmail ? (
                              <p className="truncate text-xs font-normal leading-4 text-muted-foreground">
                                {file.uploadedByEmail}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <FileActions
                            canDownload={canDownload}
                            canReview={canReview}
                            file={file}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
