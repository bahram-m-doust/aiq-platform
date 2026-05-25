"use client";

import { useState, useTransition } from "react";

type ActionResult = { status: string; message?: string };
type ServerAction<S> = (prev: S, formData: FormData) => Promise<S & ActionResult>;

export function useConfirmAction<S>({
  action,
  initialState,
  buildFormData,
  onSuccess,
}: {
  action: ServerAction<S>;
  initialState: S;
  buildFormData: () => FormData;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function confirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const result = await action(initialState, buildFormData());
      if (result.status === "error") {
        setErrorMessage(result.message ?? "An error occurred.");
        return;
      }
      onSuccess?.();
      setOpen(false);
    });
  }

  function handleOpenChange(next: boolean) {
    if (!isPending) {
      setOpen(next);
      if (!next) setErrorMessage(null);
    }
  }

  return { open, setOpen, handleOpenChange, errorMessage, isPending, confirm };
}
