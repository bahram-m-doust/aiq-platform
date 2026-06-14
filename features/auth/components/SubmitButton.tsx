"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  disabled = false,
  idleLabel,
  pendingLabel,
}: {
  disabled?: boolean;
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <Button className="w-full" disabled={isDisabled} size="lg" type="submit">
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
