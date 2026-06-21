"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";

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
import { renameBrandAction } from "@/features/admin/brands/actions";
import { initialBrandAdminActionState } from "@/features/admin/brands/types";

export function RenameBrandButton({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(brandName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== brandName;

  function handleOpenChange(next: boolean) {
    if (isPending) return;
    setOpen(next);
    if (!next) {
      setName(brandName);
      setError(null);
    }
  }

  function handleConfirm() {
    if (!canSave) return;
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("brand_id", brandId);
      formData.append("brand_name", trimmed);
      const result = await renameBrandAction(
        initialBrandAdminActionState,
        formData,
      );
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" type="button" variant="outline">
          <PencilIcon className="size-4" />
          Rename
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename “{brandName}”</DialogTitle>
          <DialogDescription>
            Update the brand&apos;s display name. This is audited.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor={`rename-brand-${brandId}`}>Brand name</Label>
          <Input
            autoComplete="off"
            id={`rename-brand-${brandId}`}
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            placeholder={brandName}
            value={name}
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
            disabled={isPending || !canSave}
            onClick={handleConfirm}
            type="button"
          >
            {isPending ? "Saving…" : "Save name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
