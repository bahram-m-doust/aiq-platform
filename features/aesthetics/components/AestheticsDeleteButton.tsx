"use client";

import { DeleteDeliverableButton } from "@/components/admin/DeleteDeliverableButton";
import { deleteAestheticsDeliverableAction } from "@/features/aesthetics/actions";
import type { AestheticsKind } from "@/lib/routes";

const kindLabels: Record<AestheticsKind, string> = {
  VISUAL_DIRECTION: "Visual Direction",
  COLOR_TYPE_SYSTEM: "Color & Type System",
  ASSET_LIBRARY: "Asset Library",
};

export function AestheticsDeleteButton({
  brandId,
  brandName,
  kind,
}: {
  brandId: string;
  brandName: string;
  kind: AestheticsKind;
}) {
  const kindLabel = kindLabels[kind];
  return (
    <DeleteDeliverableButton
      description={`This permanently removes the uploaded ${kindLabel} file for "${brandName}". The deliverable returns to "Awaiting upload". This cannot be undone.`}
      label="Delete"
      onDelete={() => deleteAestheticsDeliverableAction({ brandId, kind })}
      title={`Delete ${brandName} · ${kindLabel}?`}
    />
  );
}
