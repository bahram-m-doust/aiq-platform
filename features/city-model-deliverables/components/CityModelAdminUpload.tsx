"use client";

import { useActionState } from "react";

import { DeleteDeliverableButton } from "@/components/admin/DeleteDeliverableButton";
import { Button } from "@/components/ui/button";
import {
  deleteCityModelDistrictFileAction,
  uploadCityModelDistrictFileAction,
} from "@/features/city-model-deliverables/actions";
import { initialCityModelUploadState } from "@/features/city-model-deliverables/schema";

export function CityModelAdminUpload({
  brandId,
  districtKey,
  districtName,
  hasFile,
}: {
  brandId: string;
  districtKey: string;
  districtName: string;
  hasFile: boolean;
}) {
  const [state, action, pending] = useActionState(
    uploadCityModelDistrictFileAction,
    initialCityModelUploadState,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input name="brand_id" type="hidden" value={brandId} />
      <input name="district_key" type="hidden" value={districtKey} />
      <input
        accept="application/pdf"
        className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
        name="file"
        required
        type="file"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Uploading…" : "Upload PDF"}
        </Button>
        {hasFile ? (
          <DeleteDeliverableButton
            description={`This permanently removes the uploaded file for “${districtName}”. The district returns to “Awaiting upload”. This cannot be undone.`}
            onDelete={() =>
              deleteCityModelDistrictFileAction({ brandId, districtKey })
            }
            title={`Delete ${districtName} file?`}
          />
        ) : null}
        {state.message ? (
          <span
            className={`text-[11px] ${
              state.status === "error" ? "text-red-600" : "text-emerald-700"
            }`}
          >
            {state.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}
