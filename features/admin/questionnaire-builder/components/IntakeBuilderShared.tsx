"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import type {
  IntakeBuilderFormState,
  IntakeBuilderQuestionInputType,
} from "@/features/admin/questionnaire-builder/types";

export const inputTypeLabels: Record<IntakeBuilderQuestionInputType, string> = {
  text: "Text",
  textarea: "Textarea",
  url: "URL",
  number: "Number",
  select: "Select",
  radio: "Radio",
  checkbox: "Checkbox",
  multi_select: "Multi-select",
};

export function StatusMessage({ state }: { state: IntakeBuilderFormState }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"}>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

export function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-md border border-primary/30 px-2 py-1 text-xs font-medium text-primary"
          : "rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground"
      }
    >
      {active ? "Active" : "Archived"}
    </span>
  );
}
