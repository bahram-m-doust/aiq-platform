"use client";

import { useFormStatus } from "react-dom";

import { DSButton } from "@/components/ds/Button";

export function SubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <DSButton className="w-full" disabled={pending} size="lg" type="submit">
      {pending ? pendingLabel : idleLabel}
    </DSButton>
  );
}
