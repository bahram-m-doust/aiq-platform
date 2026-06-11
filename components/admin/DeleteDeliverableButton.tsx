"use client";

import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Admin "delete uploaded file" affordance: a destructive button that opens a
// confirmation pop-up before calling the provided server action. Used on every
// surface where an uploaded deliverable can be downloaded.
export function DeleteDeliverableButton({
  onDelete,
  label = "Delete file",
  title = "Delete this file?",
  description,
}: {
  onDelete: () => Promise<{ ok: boolean; message?: string }>;
  label?: string;
  title?: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await onDelete();
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.message ?? "Something went wrong.");
      }
    });
  };

  return (
    <ConfirmDialog
      confirmLabel="Delete"
      description={description}
      errorMessage={error}
      isPending={pending}
      onConfirm={confirm}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
      open={open}
      pendingLabel="Deleting…"
      title={title}
      trigger={
        <Button size="sm" type="button" variant="outline">
          <Trash2Icon className="size-4" />
          {label}
        </Button>
      }
    />
  );
}
