"use client";

import { useActionState } from "react";
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  archiveIntakeQuestionAction,
  archiveIntakeSectionAction,
  reorderIntakeQuestionAction,
  reorderIntakeSectionAction,
} from "@/features/admin/intake-builder/actions";
import { initialIntakeBuilderFormState } from "@/features/admin/intake-builder/schema";
import { StatusMessage } from "@/features/admin/intake-builder/components/IntakeBuilderShared";

type ReorderAction =
  | typeof reorderIntakeSectionAction
  | typeof reorderIntakeQuestionAction;

export function ReorderButton({
  id,
  direction,
  action,
  label,
}: {
  id: string;
  direction: "up" | "down";
  action: ReorderAction;
  label: string;
}) {
  const [, formAction] = useActionState(action, initialIntakeBuilderFormState);

  return (
    <form action={formAction}>
      <input name="id" type="hidden" value={id} />
      <input name="direction" type="hidden" value={direction} />
      <Button aria-label={label} size="icon-sm" type="submit" variant="outline">
        {direction === "up" ? (
          <ArrowUpIcon className="size-4" />
        ) : (
          <ArrowDownIcon className="size-4" />
        )}
      </Button>
    </form>
  );
}

export function ArchiveSectionButton({ sectionId }: { sectionId: string }) {
  const [state, formAction] = useActionState(
    archiveIntakeSectionAction,
    initialIntakeBuilderFormState,
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input name="section_id" type="hidden" value={sectionId} />
        <Button type="submit" variant="destructive">
          <ArchiveIcon className="size-4" />
          Archive section
        </Button>
      </form>
      <StatusMessage state={state} />
    </div>
  );
}

export function ArchiveQuestionButton({ questionId }: { questionId: string }) {
  const [state, formAction] = useActionState(
    archiveIntakeQuestionAction,
    initialIntakeBuilderFormState,
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input name="question_id" type="hidden" value={questionId} />
        <Button size="sm" type="submit" variant="destructive">
          <ArchiveIcon className="size-4" />
          Archive
        </Button>
      </form>
      <StatusMessage state={state} />
    </div>
  );
}
