"use client";

import { useActionState, useEffect, useRef } from "react";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

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
  createIntakeQuestionAction,
  createIntakeSectionAction,
} from "@/features/admin/intake-builder/actions";
import { initialIntakeBuilderFormState } from "@/features/admin/intake-builder/schema";
import { intakeBuilderQuestionInputTypes } from "@/features/admin/intake-builder/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";
import {
  inputTypeLabels,
  StatusMessage,
} from "@/features/admin/intake-builder/components/IntakeBuilderShared";

export function SectionCreateForm() {
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

export function QuestionCreateForm({ sectionId }: { sectionId: string }) {
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
