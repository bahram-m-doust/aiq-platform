"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadBrandIconAction } from "@/features/admin/brand-icons/actions";
import { initialBrandIconUploadFormState } from "@/features/admin/brand-icons/form-state";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} size="sm" type="submit">
      {pending ? "Uploading..." : "Upload"}
    </Button>
  );
}

export function BrandIconRow({
  brandId,
  brandName,
  iconUrl,
}: {
  brandId: string;
  brandName: string;
  iconUrl: string | null;
}) {
  const [state, formAction] = useActionState(
    uploadBrandIconAction,
    initialBrandIconUploadFormState,
  );
  const [lastSeenStatus, setLastSeenStatus] = useState(state.status);
  const [cacheKey, setCacheKey] = useState(0);
  if (state.status !== lastSeenStatus) {
    setLastSeenStatus(state.status);
    if (state.status === "success") {
      setCacheKey((c) => c + 1);
    }
  }

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-center gap-4 rounded-lg border border-border p-4"
    >
      <input name="brand_id" type="hidden" value={brandId} />
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {iconUrl ? (
          <Image
            alt={`${brandName} icon`}
            className="size-full object-contain"
            height={48}
            src={cacheKey > 0 ? `${iconUrl}?v=${cacheKey}` : iconUrl}
            unoptimized
            width={48}
          />
        ) : (
          <span className="text-[10px] font-mono uppercase text-muted-foreground">
            none
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{brandName}</p>
        <p className="font-mono text-[10px] text-muted-foreground">{brandId}</p>
      </div>
      <Input
        accept="image/png"
        className="max-w-xs"
        name="icon"
        required
        type="file"
      />
      <SubmitButton />
      {state.status === "error" ? (
        <p className="basis-full text-xs text-destructive">{state.message}</p>
      ) : null}
      {state.status === "success" ? (
        <p className="basis-full text-xs text-emerald-500">{state.message}</p>
      ) : null}
    </form>
  );
}
