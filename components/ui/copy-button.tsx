"use client";

import { useState } from "react";
import { CheckIcon, ClipboardIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  ariaLabel,
}: {
  value: string;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      aria-label={ariaLabel}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard write can fail in non-secure contexts; the
          // value is still visible in the input next to this button.
        }
      }}
      size="icon-sm"
      type="button"
      variant="outline"
    >
      {copied ? (
        <CheckIcon className="size-4" />
      ) : (
        <ClipboardIcon className="size-4" />
      )}
    </Button>
  );
}
