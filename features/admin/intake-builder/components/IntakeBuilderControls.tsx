"use client";

import { useActionState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConfirmAction } from "@/components/hooks/useConfirmAction";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  archiveIntakeQuestionAction,
  archiveIntakeSectionAction,
  deleteIntakeQuestionAction,
  deleteIntakeSectionAction,
  reorderIntakeQuestionAction,
  reorderIntakeSectionAction,
  unarchiveIntakeQuestionAction,
  unarchiveIntakeSectionAction,
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
  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: archiveIntakeSectionAction,
      initialState: initialIntakeBuilderFormState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("section_id", sectionId);
        return fd;
      },
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="destructive">
          <ArchiveIcon className="size-4" />
          Archive section
        </Button>
      }
      title="Archive section"
      description="Are you sure you want to archive this section? All questions in this section will also be hidden from the intake form."
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Archive section"
      pendingLabel="Archiving..."
    />
  );
}

export function ArchiveQuestionButton({ questionId }: { questionId: string }) {
  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: archiveIntakeQuestionAction,
      initialState: initialIntakeBuilderFormState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("question_id", questionId);
        return fd;
      },
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button size="sm" variant="destructive">
          <ArchiveIcon className="size-4" />
          Archive
        </Button>
      }
      title="Archive question"
      description="Are you sure you want to archive this question? It will be hidden from the intake form."
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Archive"
      pendingLabel="Archiving..."
    />
  );
}

export function UnarchiveSectionButton({ sectionId }: { sectionId: string }) {
  const [state, formAction] = useActionState(
    unarchiveIntakeSectionAction,
    initialIntakeBuilderFormState,
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input name="section_id" type="hidden" value={sectionId} />
        <Button type="submit" variant="outline">
          <ArchiveRestoreIcon className="size-4" />
          Unarchive section
        </Button>
      </form>
      <StatusMessage state={state} />
    </div>
  );
}

export function UnarchiveQuestionButton({ questionId }: { questionId: string }) {
  const [state, formAction] = useActionState(
    unarchiveIntakeQuestionAction,
    initialIntakeBuilderFormState,
  );

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input name="question_id" type="hidden" value={questionId} />
        <Button size="sm" type="submit" variant="outline">
          <ArchiveRestoreIcon className="size-4" />
          Unarchive
        </Button>
      </form>
      <StatusMessage state={state} />
    </div>
  );
}

export function DeleteQuestionButton({ questionId }: { questionId: string }) {
  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: deleteIntakeQuestionAction,
      initialState: initialIntakeBuilderFormState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("question_id", questionId);
        return fd;
      },
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button size="sm" variant="ghost">
          <Trash2Icon className="size-4 text-destructive" />
          Delete
        </Button>
      }
      title="Delete question"
      description="Are you sure you want to permanently delete this question? This action cannot be undone."
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Delete question"
      pendingLabel="Deleting..."
    />
  );
}

export function DeleteSectionButton({ sectionId }: { sectionId: string }) {
  const { open, handleOpenChange, errorMessage, isPending, confirm } =
    useConfirmAction({
      action: deleteIntakeSectionAction,
      initialState: initialIntakeBuilderFormState,
      buildFormData: () => {
        const fd = new FormData();
        fd.append("section_id", sectionId);
        return fd;
      },
    });

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="ghost">
          <Trash2Icon className="size-4 text-destructive" />
          Delete section
        </Button>
      }
      title="Delete section"
      description="Are you sure you want to permanently delete this section and all its questions? This action cannot be undone."
      errorMessage={errorMessage}
      isPending={isPending}
      onConfirm={confirm}
      confirmLabel="Delete section"
      pendingLabel="Deleting..."
    />
  );
}
