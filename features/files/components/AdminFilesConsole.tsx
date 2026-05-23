"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import {
  adminArchiveFileAction,
  adminDeleteFileAction,
  adminDownloadFileAction,
  adminUploadFileAction,
  initialAdminFileReviewState,
  initialAdminFileUploadState,
} from "@/features/files/admin-actions";
import type { AdminBrandOption } from "@/features/files/admin-queries";
import { fileStatusLabels, fileVisibilityLabels } from "@/features/files/schema";
import type { BrandFileRecord } from "@/features/files/types";
import { fileVisibilities } from "@/features/files/types";

function formatSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
    adminUploadFileAction,
    initialAdminFileUploadState,
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
          <Label htmlFor="admin_upload_file">File</Label>
          <Input id="admin_upload_file" name="file" required type="file" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin_upload_visibility">Visibility</Label>
          <Select defaultValue="OWNER_ONLY" name="visibility">
            <SelectTrigger id="admin_upload_visibility">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fileVisibilities.map((visibility) => (
                <SelectItem key={visibility} value={visibility}>
                  {fileVisibilityLabels[visibility]}
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

function ArchiveButton({ fileId }: { fileId: string }) {
  const [state, formAction] = useActionState(
    adminArchiveFileAction,
    initialAdminFileReviewState,
  );

  return (
    <form action={formAction} className="inline-flex">
      <input name="file_id" type="hidden" value={fileId} />
      <Button size="sm" type="submit" variant="outline">
        {state.status === "success" ? "Archived" : "Archive"}
      </Button>
    </form>
  );
}

function DeleteButton({ fileId }: { fileId: string }) {
  const [state, formAction] = useActionState(
    adminDeleteFileAction,
    initialAdminFileReviewState,
  );

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input name="file_id" type="hidden" value={fileId} />
      <Input
        aria-label="Type DELETE to confirm"
        className="h-7 w-24"
        name="confirm"
        placeholder="DELETE"
      />
      <Button size="sm" type="submit" variant="destructive">
        {state.status === "success" ? "Deleted" : "Delete"}
      </Button>
    </form>
  );
}

function DownloadForm({ fileId }: { fileId: string }) {
  return (
    <form action={adminDownloadFileAction} className="inline-flex">
      <input name="file_id" type="hidden" value={fileId} />
      <Button size="sm" type="submit" variant="outline">
        Download
      </Button>
    </form>
  );
}

function FilesTable({ files }: { files: BrandFileRecord[] }) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No files for this brand yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Visibility</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Size</th>
            <th className="py-2 pr-3">Uploaded</th>
            <th className="py-2 pr-3">By</th>
            <th className="py-2 pr-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr
              key={file.id}
              className={
                file.status === "ARCHIVED"
                  ? "border-t border-border text-muted-foreground"
                  : "border-t border-border"
              }
            >
              <td className="py-2 pr-3 font-medium">{file.originalName}</td>
              <td className="py-2 pr-3">{fileVisibilityLabels[file.visibility]}</td>
              <td className="py-2 pr-3">{fileStatusLabels[file.status]}</td>
              <td className="py-2 pr-3">{formatSize(file.sizeBytes)}</td>
              <td className="py-2 pr-3">
                {file.createdAt
                  ? new Date(file.createdAt).toLocaleString()
                  : "—"}
              </td>
              <td className="py-2 pr-3">{file.uploadedByEmail ?? "—"}</td>
              <td className="py-2 pr-3">
                <div className="flex flex-wrap items-center gap-2">
                  <DownloadForm fileId={file.id} />
                  {file.status !== "ARCHIVED" ? (
                    <ArchiveButton fileId={file.id} />
                  ) : null}
                  <DeleteButton fileId={file.id} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminFilesConsole({
  brands,
  selectedBrandId,
  files,
}: {
  brands: AdminBrandOption[];
  selectedBrandId: string | null;
  files: BrandFileRecord[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand selector</CardTitle>
          <CardDescription>
            Pick a brand to upload, download, archive, or delete files.
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
              <CardTitle>Upload file</CardTitle>
              <CardDescription>
                File is stored under the selected brand and audited.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm brandId={selectedBrandId} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
              <CardDescription>
                {files.length} file{files.length === 1 ? "" : "s"}.
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
