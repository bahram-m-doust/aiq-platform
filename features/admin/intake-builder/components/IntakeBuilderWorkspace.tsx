"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  ArchiveIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  SaveIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveIntakeQuestionAction,
  archiveIntakeSectionAction,
  createIntakeQuestionAction,
  createIntakeSectionAction,
  reorderIntakeQuestionAction,
  reorderIntakeSectionAction,
  updateIntakeQuestionAction,
  updateIntakeSectionAction,
} from "@/features/admin/intake-builder/actions";
import {
  initialIntakeBuilderFormState,
  optionsTextFromValidationSchema,
} from "@/features/admin/intake-builder/schema";
import type {
  IntakeBuilderFormState,
  IntakeBuilderQuestion,
  IntakeBuilderQuestionInputType,
  IntakeBuilderSection,
} from "@/features/admin/intake-builder/types";
import { intakeBuilderQuestionInputTypes } from "@/features/admin/intake-builder/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

const inputTypeLabels: Record<IntakeBuilderQuestionInputType, string> = {
  text: "Text",
  textarea: "Textarea",
  url: "URL",
  number: "Number",
  select: "Select",
  radio: "Radio",
  checkbox: "Checkbox",
  multi_select: "Multi-select",
};

function StatusMessage({ state }: { state: IntakeBuilderFormState }) {
  if (state.status === "idle") {
    return null;
  }

  return (
    <Alert variant={state.status === "error" ? "destructive" : "default"}>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function ActivePill({ active }: { active: boolean }) {
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

function SectionCreateForm() {
  const [state, formAction] = useActionState(
    createIntakeSectionAction,
    initialIntakeBuilderFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [router, state.status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add section</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4" ref={formRef}>
          <StatusMessage state={state} />
          <div className="grid gap-4 md:grid-cols-[1fr_9rem]">
            <div className="space-y-2">
              <Label htmlFor="new-section-title">Title</Label>
              <Input
                id="new-section-title"
                name="title"
                placeholder="Company"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-section-order">Order</Label>
              <Input
                id="new-section-order"
                min={1}
                name="order_index"
                placeholder="Auto"
                type="number"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-section-description">Description</Label>
            <Textarea
              id="new-section-description"
              name="description"
              placeholder="Short executive guidance for this section"
            />
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <Checkbox
              defaultChecked
              id="new-section-required"
              name="is_required"
              value="true"
            />
            <Label className="cursor-pointer" htmlFor="new-section-required">
              Required section
            </Label>
          </div>
          <SubmitButton idleLabel="Add section" pendingLabel="Adding" />
        </form>
      </CardContent>
    </Card>
  );
}

function QuestionCreateForm({ sectionId }: { sectionId: string }) {
  const [state, formAction] = useActionState(
    createIntakeQuestionAction,
    initialIntakeBuilderFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.status !== "success") {
      return;
    }

    formRef.current?.reset();
    router.refresh();
  }, [router, state.status]);

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-lg border border-border p-4"
      ref={formRef}
    >
      <input name="section_id" type="hidden" value={sectionId} />
      <StatusMessage state={state} />
      <div className="grid gap-3 md:grid-cols-[1fr_11rem_8rem]">
        <div className="space-y-2">
          <Label htmlFor={`new-question-${sectionId}`}>New question</Label>
          <Input
            id={`new-question-${sectionId}`}
            name="question_text"
            placeholder="What should the strategic team know?"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`new-question-type-${sectionId}`}>Input type</Label>
          <Select defaultValue="textarea" name="input_type">
            <SelectTrigger id={`new-question-type-${sectionId}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intakeBuilderQuestionInputTypes.map((inputType) => (
                <SelectItem key={inputType} value={inputType}>
                  {inputTypeLabels[inputType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`new-question-order-${sectionId}`}>Order</Label>
          <Input
            id={`new-question-order-${sectionId}`}
            min={1}
            name="order_index"
            placeholder="Auto"
            type="number"
          />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`new-question-help-${sectionId}`}>Help text</Label>
          <Textarea
            id={`new-question-help-${sectionId}`}
            name="help_text"
            placeholder="Optional instruction shown below the question"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`new-question-options-${sectionId}`}>Options</Label>
          <Textarea
            id={`new-question-options-${sectionId}`}
            name="options"
            placeholder="One option per line for select, radio, or multi-select"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <Checkbox
          defaultChecked
          id={`new-question-required-${sectionId}`}
          name="is_required"
          value="true"
        />
        <Label
          className="cursor-pointer"
          htmlFor={`new-question-required-${sectionId}`}
        >
          Required question
        </Label>
      </div>
      <div className="flex justify-end">
        <Button type="submit">
          <PlusIcon className="size-4" />
          Add question
        </Button>
      </div>
    </form>
  );
}

function ReorderButton({
  id,
  direction,
  action,
  label,
}: {
  id: string;
  direction: "up" | "down";
  action: typeof reorderIntakeSectionAction | typeof reorderIntakeQuestionAction;
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

function ArchiveSectionButton({ sectionId }: { sectionId: string }) {
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

function ArchiveQuestionButton({ questionId }: { questionId: string }) {
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

function QuestionEditor({ question }: { question: IntakeBuilderQuestion }) {
  const [state, formAction] = useActionState(
    updateIntakeQuestionAction,
    initialIntakeBuilderFormState,
  );

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{question.questionText}</h3>
            <ActivePill active={question.isActive} />
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            {question.key}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {question.isActive ? (
            <>
              <ReorderButton
                action={reorderIntakeQuestionAction}
                direction="up"
                id={question.id}
                label={`Move ${question.questionText} up`}
              />
              <ReorderButton
                action={reorderIntakeQuestionAction}
                direction="down"
                id={question.id}
                label={`Move ${question.questionText} down`}
              />
              <ArchiveQuestionButton questionId={question.id} />
            </>
          ) : null}
        </div>
      </div>

      <form action={formAction} className="grid gap-3">
        <input name="question_id" type="hidden" value={question.id} />
        <input name="section_id" type="hidden" value={question.sectionId} />
        <StatusMessage state={state} />
        <div className="grid gap-3 md:grid-cols-[1fr_11rem_8rem]">
          <div className="space-y-2">
            <Label htmlFor={`question-text-${question.id}`}>Question text</Label>
            <Input
              defaultValue={question.questionText}
              id={`question-text-${question.id}`}
              name="question_text"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`question-type-${question.id}`}>Input type</Label>
            <Select defaultValue={question.inputType} name="input_type">
              <SelectTrigger id={`question-type-${question.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {intakeBuilderQuestionInputTypes.map((inputType) => (
                  <SelectItem key={inputType} value={inputType}>
                    {inputTypeLabels[inputType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`question-order-${question.id}`}>Order</Label>
            <Input
              defaultValue={question.orderIndex}
              id={`question-order-${question.id}`}
              min={1}
              name="order_index"
              required
              type="number"
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`question-help-${question.id}`}>Help text</Label>
            <Textarea
              defaultValue={question.helpText ?? ""}
              id={`question-help-${question.id}`}
              name="help_text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`question-options-${question.id}`}>Options</Label>
            <Textarea
              defaultValue={optionsTextFromValidationSchema(
                question.validationSchema,
              )}
              id={`question-options-${question.id}`}
              name="options"
              placeholder="One option per line"
            />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Checkbox
            defaultChecked={question.isRequired}
            id={`question-required-${question.id}`}
            name="is_required"
            value="true"
          />
          <Label
            className="cursor-pointer"
            htmlFor={`question-required-${question.id}`}
          >
            Required question
          </Label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline">
            <SaveIcon className="size-4" />
            Save question
          </Button>
        </div>
      </form>
    </div>
  );
}

function SectionEditor({ section }: { section: IntakeBuilderSection }) {
  const [state, formAction] = useActionState(
    updateIntakeSectionAction,
    initialIntakeBuilderFormState,
  );
  const activeQuestions = section.questions.filter((question) => question.isActive);
  const archivedQuestions = section.questions.filter(
    (question) => !question.isActive,
  );

  return (
    <section className="space-y-5 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <ActivePill active={section.isActive} />
          </div>
          <p className="font-mono text-xs text-muted-foreground">{section.key}</p>
          <p className="text-sm text-muted-foreground">
            {activeQuestions.length} active questions
            {archivedQuestions.length > 0
              ? `, ${archivedQuestions.length} archived`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {section.isActive ? (
            <>
              <ReorderButton
                action={reorderIntakeSectionAction}
                direction="up"
                id={section.id}
                label={`Move ${section.title} up`}
              />
              <ReorderButton
                action={reorderIntakeSectionAction}
                direction="down"
                id={section.id}
                label={`Move ${section.title} down`}
              />
              <ArchiveSectionButton sectionId={section.id} />
            </>
          ) : null}
        </div>
      </div>

      <form action={formAction} className="grid gap-4">
        <input name="section_id" type="hidden" value={section.id} />
        <StatusMessage state={state} />
        <div className="grid gap-4 md:grid-cols-[1fr_9rem]">
          <div className="space-y-2">
            <Label htmlFor={`section-title-${section.id}`}>Title</Label>
            <Input
              defaultValue={section.title}
              id={`section-title-${section.id}`}
              name="title"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`section-order-${section.id}`}>Order</Label>
            <Input
              defaultValue={section.orderIndex}
              id={`section-order-${section.id}`}
              min={1}
              name="order_index"
              required
              type="number"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`section-description-${section.id}`}>Description</Label>
          <Textarea
            defaultValue={section.description ?? ""}
            id={`section-description-${section.id}`}
            name="description"
          />
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border p-3">
          <Checkbox
            defaultChecked={section.isRequired}
            id={`section-required-${section.id}`}
            name="is_required"
            value="true"
          />
          <Label
            className="cursor-pointer"
            htmlFor={`section-required-${section.id}`}
          >
            Required section
          </Label>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline">
            <SaveIcon className="size-4" />
            Save section
          </Button>
        </div>
      </form>

      {section.isActive ? <QuestionCreateForm sectionId={section.id} /> : null}

      <div className="grid gap-4">
        {section.questions.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            No questions are configured for this section.
          </p>
        ) : (
          section.questions.map((question) => (
            <QuestionEditor key={question.id} question={question} />
          ))
        )}
      </div>
    </section>
  );
}

export function IntakeBuilderWorkspace({
  sections,
}: {
  sections: IntakeBuilderSection[];
}) {
  return (
    <div className="space-y-6">
      <SectionCreateForm />
      <Card>
        <CardHeader>
          <CardTitle>Question bank</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {sections.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No intake sections are configured yet.
            </p>
          ) : (
            sections.map((section) => (
              <SectionEditor key={section.id} section={section} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
