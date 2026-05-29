"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DSCard, DSCardBody, DSCardHeader } from "@/components/ds/Card";
import { Label } from "@/components/ui/label";
import {
  initialModelPrefFormState,
  setDefaultImageModelAction,
  setDefaultTextModelAction,
} from "@/features/openrouter/preferences-actions";
import {
  IMAGE_MODELS,
  TEXT_MODELS,
  type ImageModelId,
  type TextModelId,
} from "@/lib/openrouter/models";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <Button disabled={pending} size="sm" type="submit">
      {pending ? "Saving..." : "Save"}
    </Button>
  );
}

export function DefaultTextModelCard({
  currentModel,
}: {
  currentModel: TextModelId;
}) {
  const [state, formAction] = useActionState(
    setDefaultTextModelAction,
    initialModelPrefFormState,
  );
  const [selected, setSelected] = useState<TextModelId>(currentModel);
  const detail = TEXT_MODELS.find((m) => m.id === selected);

  return (
    <DSCard>
      <DSCardHeader>
        <h2 className="ds-h2">Default text model</h2>
        <p className="ds-body mt-1">
          Used by Brand Brain and every catalog agent unless overridden per-run.
        </p>
      </DSCardHeader>
      <DSCardBody>
        <form action={formAction} className="space-y-3">
          <Label htmlFor="default-text-model">Text model</Label>
          <select
            className="flex h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            id="default-text-model"
            name="text_model"
            onChange={(e) => setSelected(e.target.value as TextModelId)}
            style={{ borderColor: "var(--bv-line)" }}
            value={selected}
          >
            {TEXT_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {detail ? (
            <p className="ds-caption">{detail.blurb}</p>
          ) : null}
          <SaveBtn />
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "success" ? (
            <p className="text-xs text-emerald-500">{state.message}</p>
          ) : null}
        </form>
      </DSCardBody>
    </DSCard>
  );
}

export function DefaultImageModelCard({
  currentModel,
}: {
  currentModel: ImageModelId;
}) {
  const [state, formAction] = useActionState(
    setDefaultImageModelAction,
    initialModelPrefFormState,
  );
  const [selected, setSelected] = useState<ImageModelId>(currentModel);
  const detail = IMAGE_MODELS.find((m) => m.id === selected);

  return (
    <DSCard>
      <DSCardHeader>
        <h2 className="ds-h2">Default image model</h2>
        <p className="ds-body mt-1">
          Used by the Image Generator agent when no per-run override is set.
        </p>
      </DSCardHeader>
      <DSCardBody>
        <form action={formAction} className="space-y-3">
          <Label htmlFor="default-image-model">Image model</Label>
          <select
            className="flex h-10 w-full rounded-md border bg-transparent px-3 text-sm"
            id="default-image-model"
            name="image_model"
            onChange={(e) => setSelected(e.target.value as ImageModelId)}
            style={{ borderColor: "var(--bv-line)" }}
            value={selected}
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {detail ? (
            <p className="ds-caption">{detail.blurb}</p>
          ) : null}
          <SaveBtn />
          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {state.status === "success" ? (
            <p className="text-xs text-emerald-500">{state.message}</p>
          ) : null}
        </form>
      </DSCardBody>
    </DSCard>
  );
}
