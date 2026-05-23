"use client";

import { useActionState } from "react";
import { SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
  reorderIntakeQuestionAction,
  updateIntakeQuestionAction,
} from "@/features/admin/intake-builder/actions";
import {
  initialIntakeBuilderFormState,
  optionsTextFromValidationSchema,
} from "@/features/admin/intake-builder/schema";
import type { IntakeBuilderQuestion } from "@/features/admin/intake-builder/types";
import { intakeBuilderQuestionInputTypes } from "@/features/admin/intake-builder/types";
import {
  ArchiveQuestionButton,
  ReorderButton,
  UnarchiveQuestionButton,
} from "@/features/admin/intake-builder/components/IntakeBuilderControls";
import {
  ActivePill,
  inputTypeLabels,
  StatusMessage,
} from "@/features/admin/intake-builder/components/IntakeBuilderShared";

export function QuestionEditor({
  question,
}: {
  question: IntakeBuilderQuestion;
}) {
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
          ) : (
            <UnarchiveQuestionButton questionId={question.id} />
          )}
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
