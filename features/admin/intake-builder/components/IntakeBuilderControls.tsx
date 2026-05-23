"use client";

import { useState, useActionState, useTransition } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  archiveIntakeQuestionAction,
  archiveIntakeSectionAction,
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
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("section_id", sectionId);
      const result = await archiveIntakeSectionAction(
        initialIntakeBuilderFormState,
        formData,
      );
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <ArchiveIcon className="size-4" />
          Archive section
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive section</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive this section? All questions in this
            section will also be hidden from the intake form.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Archiving..." : "Archive section"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ArchiveQuestionButton({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setErrorMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.append("question_id", questionId);
      const result = await archiveIntakeQuestionAction(
        initialIntakeBuilderFormState,
        formData,
      );
      if (result.status === "error") {
        setErrorMessage(result.message);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <ArchiveIcon className="size-4" />
          Archive
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive question</DialogTitle>
          <DialogDescription>
            Are you sure you want to archive this question? It will be hidden
            from the intake form.
          </DialogDescription>
        </DialogHeader>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Archiving..." : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
