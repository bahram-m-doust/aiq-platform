"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteBrandAction } from "@/features/admin/brands/actions";
import { initialBrandAdminActionState } from "@/features/admin/brands/types";

export function DeleteBrandButton({
  brandId,
  brandName,
  memberCount,
}: {
  brandId: string;
  brandName: string;
  memberCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const matches = typed.trim() === brandName;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  }

  function handleConfirm() {
    if (!matches) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("brand_id", brandId);
      formData.append("confirm_name", typed.trim());
      const result = await deleteBrandAction(
        initialBrandAdminActionState,
        formData,
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
      setTyped("");
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="destructive">
          <Trash2Icon className="size-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{brandName}”?</DialogTitle>
          <DialogDescription>
            This permanently deletes the brand and everything attached to it —
            {" "}
            {memberCount} member{memberCount === 1 ? "" : "s"}, the
            questionnaire, modules, deliverables, documents, and AI history.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`confirm-delete-${brandId}`}>
            Type <span className="font-semibold">{brandName}</span> to confirm
          </Label>
          <Input
            autoComplete="off"
            id={`confirm-delete-${brandId}`}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={brandName}
            value={typed}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            disabled={isPending}
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={isPending || !matches}
            onClick={handleConfirm}
            type="button"
            variant="destructive"
          >
            {isPending ? "Deleting…" : "Permanently delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
