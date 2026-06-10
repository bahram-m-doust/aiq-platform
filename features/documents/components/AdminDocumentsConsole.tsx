"use client";

import { useActionState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  BrainIcon,
  DownloadIcon,
  KeyIcon,
  TrashIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfirmAction } from "@/components/hooks/useConfirmAction";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import {
  adminArchiveDocumentAction,
  adminDeleteDocumentAction,
  adminDownloadDocumentAction,
  adminPromoteDocumentToRagAction,
  adminUnarchiveDocumentAction,
  adminUploadDocumentAction,
} from "@/features/documents/admin-actions";
import {
  adminDeleteBrandApiKeyAction,
  adminSetBrandApiKeyAction,
} from "@/features/brands/api-key-actions";
import { initialApiKeyFormState } from "@/features/brands/api-key-form-state";
import type { AdminBrandOption } from "@/features/documents/admin-queries";
import {
  initialAdminDocumentReviewState,
  initialAdminDocumentUploadState,
} from "@/features/documents/admin-types";
import { documentStatusLabels, documentVisibilityLabels } from "@/features/documents/schema";
import type { BrandDocumentRecord, DocumentStatus } from "@/features/documents/types";
import { documentVisibilities } from "@/features/documents/types";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeClass(status: DocumentStatus) {
  switch (status) {
    case "ARCHIVED":
      return "bg-muted text-muted-foreground";
    case "OWNER_REJECTED":
      return "bg-destructive/15 text-destructive";
    case "OWNER_APPROVED":
    case "CLIENT_APPROVED":
    case "RAG_APPROVED":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
    case "PENDING_OWNER_APPROVAL":
    case "CLIENT_REVIEW":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
    default:
      return "bg-primary/10 text-primary";
  }
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        statusBadgeClass(status),
      )}
    >
      {documentStatusLabels[status]}
    </span>
  );
}

function BrandPicker({
  brands,
  selectedBrandId,
}: {
  brands: AdminBrandOption[];
  selectedBrandId: string | null;
}) {
  return (
    <form className="flex flex-wrap items-end gap-3" method="get">
      <div className="space-y-2">
        <Label htmlFor="brand_id">Brand</Label>
        <Select defaultValue={selectedBrandId ?? undefined} name="brand_id">
          <SelectTrigger className="w-72" id="brand_id">
            <SelectValue placeholder="Select a brand" />
          </SelectTrigger>
          <SelectContent>
            {brands.map((brand) => (
              <SelectItem key={brand.id} value={brand.id}>
                {brand.name} ({brand.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline">
        Load files
      </Button>
    </form>
  );
}

function UploadForm({ brandId }: { brandId: string }) {
  const [state, formAction] = useActionState(
    adminUploadDocumentAction,
    initialAdminDocumentUploadState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="brand_id" type="hidden" value={brandId} />
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
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-2">
          <Label htmlFor="admin_upload_file">Document</Label>
          <Input
            accept=".pdf,.docx,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv"
            id="admin_upload_file"
            name="file"
            required
            type="file"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin_upload_visibility">Visibility</Label>
          <Select defaultValue="OWNER_ONLY" name="visibility">
            <SelectTrigger id="admin_upload_visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {documentVisibilities.map((visibility) => (
                <SelectItem key={visibility} value={visibility}>
                  {documentVisibilityLabels[visibility]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SubmitButton idleLabel="Upload" pendingLabel="Uploading" />
      </div>
    </form>
  );
}

function ArchiveActionButton({ fileId }: { fileId: string }) {
  const [, formAction] = useActionState(
    adminArchiveDocumentAction,
    initialAdminDocumentReviewState,
  );

  return (
    <form action={formAction} className="inline-flex">
      <input name="file_id" type="hidden" value={fileId} />
      <Button
        aria-label="Archive document"
        size="icon-sm"
        title="Archive"
        type="submit"
        variant="ghost"
      >
        <ArchiveIcon className="size-4" />
      </Button>
    </form>
  );
}

function UnarchiveActionButton({ fileId }: { fileId: string }) {
  const [, formAction] = useActionState(
    adminUnarchiveDocumentAction,
    initialAdminDocumentReviewState,
  );

  return (
    <form action={formAction} className="inline-flex">
      <input name="file_id" type="hidden" value={fileId} />
      <Button
        aria-label="Restore archived document"
        size="icon-sm"
        title="Unarchive"
        type="submit"
        variant="ghost"
      >
        <ArchiveRestoreIcon className="size-4" />
      </Button>
    </form>
  );
}

function DeleteActionButton({ file }: { file: BrandDocumentRecord }) {
  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: adminDeleteDocumentAction,
      initialState: initialAdminDocumentReviewState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("file_id", file.id);
        return fd;
      },
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button
          aria-label="Delete document"
          size="icon-sm"
          title="Delete"
          type="button"
          variant="ghost"
        >
          <TrashIcon className="size-4 text-destructive" />
        </Button>
      }
      title="Delete this document?"
      description={`You are about to permanently delete ${file.originalName}. This removes both the database row and the storage object. This action cannot be undone.`}
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Delete permanently"
      pendingLabel="Deleting..."
    />
  );
}

function DownloadButton({ fileId }: { fileId: string }) {
  return (
    <form action={adminDownloadDocumentAction} className="inline-flex">
      <input name="file_id" type="hidden" value={fileId} />
      <Button
        aria-label="Download document"
        size="icon-sm"
        title="Download"
        type="submit"
        variant="ghost"
      >
        <DownloadIcon className="size-4" />
      </Button>
    </form>
  );
}

const ragPromotableStatuses = new Set<DocumentStatus>([
  "UPLOADED",
  "PENDING_OWNER_APPROVAL",
  "OWNER_APPROVED",
  "INTERNAL_DRAFT",
  "SUPERVISOR_APPROVED",
  "CLIENT_REVIEW",
  "CLIENT_APPROVED",
]);

function PromoteToRagButton({ file }: { file: BrandDocumentRecord }) {
  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: adminPromoteDocumentToRagAction,
      initialState: initialAdminDocumentReviewState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("file_id", file.id);
        return fd;
      },
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button
          aria-label="Promote to RAG"
          size="icon-sm"
          title="Promote to RAG"
          type="button"
          variant="ghost"
        >
          <BrainIcon className="size-4 text-emerald-600" />
        </Button>
      }
      title="Promote this document to RAG?"
      description={`This will mark "${file.originalName}" as RAG-approved and make it eligible for Knowledge Brain sync.`}
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Promote to RAG"
      pendingLabel="Promoting..."
    />
  );
}

function FileRowActions({ file }: { file: BrandDocumentRecord }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <DownloadButton fileId={file.id} />
      {ragPromotableStatuses.has(file.status) ? (
        <PromoteToRagButton file={file} />
      ) : null}
      {file.status === "ARCHIVED" ? (
        <UnarchiveActionButton fileId={file.id} />
      ) : (
        <ArchiveActionButton fileId={file.id} />
      )}
      <DeleteActionButton file={file} />
    </div>
  );
}

function FilesTable({ files }: { files: BrandDocumentRecord[] }) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No files for this brand yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col />
          <col className="w-32" />
          <col className="w-36" />
          <col className="w-20" />
          <col className="w-28" />
          <col className="w-32" />
        </colgroup>
        <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Visibility</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Uploaded</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              className={cn(
                "border-t border-border",
                file.status === "ARCHIVED" && "text-muted-foreground",
              )}
            >
              <td className="truncate px-3 py-2 font-medium" title={file.originalName}>
                {file.originalName}
                {file.uploadedByEmail ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {file.uploadedByEmail}
                  </span>
                ) : null}
              </td>
              <td className="px-3 py-2 text-xs">
                {documentVisibilityLabels[file.visibility]}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={file.status} />
              </td>
              <td className="px-3 py-2 text-xs tabular-nums">
                {formatSize(file.sizeBytes)}
              </td>
              <td className="px-3 py-2 text-xs">{formatDate(file.createdAt)}</td>
              <td className="px-3 py-2">
                <FileRowActions file={file} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiKeyPanel({ brandId, hasApiKey }: { brandId: string; hasApiKey: boolean }) {
  const [setState, setAction] = useActionState(
    adminSetBrandApiKeyAction,
    initialApiKeyFormState,
  );
  const [deleteState, deleteAction] = useActionState(
    adminDeleteBrandApiKeyAction,
    initialApiKeyFormState,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <KeyIcon className="size-4" />
        <span className={hasApiKey ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
          {hasApiKey ? "Brand-specific key active" : "Using global key"}
        </span>
      </div>

      {setState.status === "error" ? (
        <Alert variant="destructive">
          <AlertDescription>{setState.message}</AlertDescription>
        </Alert>
      ) : null}
      {setState.status === "success" ? (
        <Alert>
          <AlertDescription>{setState.message}</AlertDescription>
        </Alert>
      ) : null}
      {deleteState.status === "success" ? (
        <Alert>
          <AlertDescription>{deleteState.message}</AlertDescription>
        </Alert>
      ) : null}

      <form action={setAction} className="flex items-end gap-3">
        <input name="brand_id" type="hidden" value={brandId} />
        <div className="flex-1 space-y-2">
          <Label htmlFor="brand_api_key">OpenRouter API Key</Label>
          <Input
            id="brand_api_key"
            name="api_key"
            placeholder="sk-or-v1-..."
            type="password"
            required
          />
        </div>
        <SubmitButton idleLabel="Save key" pendingLabel="Saving..." />
      </form>

      {hasApiKey ? (
        <form action={deleteAction} className="inline-flex">
          <input name="brand_id" type="hidden" value={brandId} />
          <Button size="sm" type="submit" variant="outline">
            Remove brand key
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function AdminDocumentsConsole({
  brands,
  selectedBrandId,
  files,
  hasApiKey = false,
}: {
  brands: AdminBrandOption[];
  selectedBrandId: string | null;
  files: BrandDocumentRecord[];
  hasApiKey?: boolean;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand selector</CardTitle>
          <CardDescription>
            Pick a brand to upload, download, archive, restore, or delete files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandPicker brands={brands} selectedBrandId={selectedBrandId} />
        </CardContent>
      </Card>

      {selectedBrandId ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>OpenRouter API Key</CardTitle>
              <CardDescription>
                Set a brand-specific OpenRouter key for cost tracking, or use the global key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeyPanel brandId={selectedBrandId} hasApiKey={hasApiKey} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload document</CardTitle>
              <CardDescription>
                Document is stored under the selected brand and audited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm brandId={selectedBrandId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {files.length} document{files.length === 1 ? "" : "s"}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FilesTable files={files} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
