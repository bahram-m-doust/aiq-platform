"use client";

import { useActionState, useRef, useState } from "react";
import { FileTextIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { uploadDocumentAction } from "@/features/documents/actions";
import {
  defaultUploadVisibility,
  initialDocumentUploadFormState,
} from "@/features/documents/schema";
import type { DocumentAccessContext } from "@/features/documents/types";

function formatSelectedSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadTrayIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15M7 8L12 3L17 8M12 3V15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function DocumentUploader({ access }: { access: DocumentAccessContext }) {
  const [state, formAction] = useActionState(
    uploadDocumentAction,
    initialDocumentUploadFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const defaultVisibility = defaultUploadVisibility(access.membershipRole);

  return (
    <Card className="gap-0 overflow-visible border-0 bg-transparent py-0 shadow-none ring-0">
      <CardContent className="p-0">
        <form action={formAction} className="grid gap-6" ref={formRef}>
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

          <div>
            <Label
              className="flex min-h-[152px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/55 bg-background px-6 py-8 text-center transition-colors hover:border-primary/60 hover:bg-muted/40"
              htmlFor="file"
            >
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <UploadTrayIcon className="size-5" />
              </span>
              <span className="text-sm font-medium leading-5 text-foreground">
                <span className="underline underline-offset-2">
                  Click to upload
                </span>{" "}
                <span className="font-normal text-muted-foreground">
                  or drag and drop
                </span>
              </span>
              <span
                className="mt-1 text-xs font-normal leading-4 text-muted-foreground"
                id="file_description"
              >
                PDF, DOCX, TXT, MD or CSV files
              </span>
            </Label>
            <input
              aria-describedby="file_description"
              accept=".pdf,.docx,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"
              className="absolute size-px overflow-hidden whitespace-nowrap opacity-0"
              id="file"
              name="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setSelectedFile(file);

                if (file) {
                  window.setTimeout(() => formRef.current?.requestSubmit(), 0);
                }
              }}
              required
              type="file"
            />
            <input
              name="visibility"
              type="hidden"
              value={defaultVisibility}
            />

            {selectedFile ? (
              <div className="mt-4 rounded-lg border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-600">
                    <FileTextIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-5">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm font-normal leading-5 text-muted-foreground">
                      {formatSelectedSize(selectedFile.size)}
                    </p>
                    <div className="mt-3 h-2 rounded-full bg-muted">
                      <div className="h-full w-full rounded-full bg-primary" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {access.membershipRole === "BRAND_SPECIALIST" ? (
              <p className="mt-4 text-sm font-normal leading-5 text-muted-foreground">
                Brand Specialist uploads are held for Owner approval before they
                become broadly available to the brand team.
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
