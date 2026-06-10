"use client";

import { useActionState } from "react";
import { SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  reorderIntakeSectionAction,
  updateIntakeSectionAction,
} from "@/features/admin/questionnaire-builder/actions";
import { initialIntakeBuilderFormState } from "@/features/admin/questionnaire-builder/schema";
import type { IntakeBuilderSection } from "@/features/admin/questionnaire-builder/types";
import {
  ArchiveSectionButton,
  DeleteSectionButton,
  UnarchiveSectionButton,
  ReorderButton,
} from "@/features/admin/questionnaire-builder/components/IntakeBuilderControls";
import { QuestionCreateForm } from "@/features/admin/questionnaire-builder/components/IntakeBuilderCreateForms";
import { QuestionEditor } from "@/features/admin/questionnaire-builder/components/IntakeBuilderQuestionEditor";
import {
  ActivePill,
  StatusMessage,
} from "@/features/admin/questionnaire-builder/components/IntakeBuilderShared";

export function SectionEditor({ section }: { section: IntakeBuilderSection }) {
  const [state, formAction] = useActionState(
    updateIntakeSectionAction,
    initialIntakeBuilderFormState,
  );
  const activeQuestions = section.questions.filter(
    (question) => question.isActive,
  );
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
              <DeleteSectionButton sectionId={section.id} />
            </>
          ) : (
            <>
              <UnarchiveSectionButton sectionId={section.id} />
              <DeleteSectionButton sectionId={section.id} />
            </>
          )}
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
