"use client";

import { useMemo, useState, useTransition } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { autosaveIntakeAnswerAction } from "@/features/intake/actions";
import {
  parseQuestionOptions,
  resolveQuestionInputKind,
} from "@/features/intake/schemas";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  IntakeAnswerValue,
  IntakeQuestion,
} from "@/features/intake/types";

type AutosaveAction = (
  input: AutosaveIntakeAnswerInput,
) => Promise<AutosaveIntakeAnswerResult>;

function valueToString(value: IntakeAnswerValue) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

function valueToStringArray(value: IntakeAnswerValue) {
  return Array.isArray(value) ? value : [];
}

function statusLabel({
  isPending,
  status,
}: {
  isPending: boolean;
  status: "idle" | "saved" | "error";
}) {
  if (isPending) {
    return "Saving";
  }

  if (status === "saved") {
    return "Saved";
  }

  if (status === "error") {
    return "Unable to save";
  }

  return "Ready";
}

export function QuestionRenderer({
  sessionId,
  question,
  value,
  onSaved,
  autosaveAction = autosaveIntakeAnswerAction,
}: {
  sessionId: string;
  question: IntakeQuestion;
  value: IntakeAnswerValue;
  onSaved?: (questionId: string, value: IntakeAnswerValue) => void;
  autosaveAction?: AutosaveAction;
}) {
  const [localValue, setLocalValue] = useState<IntakeAnswerValue>(value);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const kind = resolveQuestionInputKind(question.inputType);
  const options = useMemo(
    () => parseQuestionOptions(question.validationSchema),
    [question.validationSchema],
  );
  const controlId = `question-${question.id}`;
  const statusId = `${controlId}-status`;

  function save(nextValue: unknown) {
    startTransition(async () => {
      const result = await autosaveAction({
        sessionId,
        questionId: question.id,
        value: nextValue,
      });

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return;
      }

      setLocalValue(result.value);
      setStatus("saved");
      setMessage("");
      onSaved?.(question.id, result.value);
    });
  }

  function renderControl() {
    if (kind === "select") {
      return (
        <Select
          onValueChange={(nextValue) => save(nextValue)}
          value={typeof localValue === "string" ? localValue : undefined}
        >
          <SelectTrigger aria-describedby={statusId} id={controlId}>
            <SelectValue placeholder="Select an answer" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (kind === "radio") {
      return (
        <div className="grid gap-2" role="radiogroup" aria-describedby={statusId}>
          {options.map((option) => (
            <label
              className="flex items-center gap-2 text-sm"
              key={option.value}
            >
              <input
                checked={localValue === option.value}
                className="size-4"
                name={controlId}
                onChange={() => save(option.value)}
                type="radio"
                value={option.value}
              />
              {option.label}
            </label>
          ))}
        </div>
      );
    }

    if (kind === "checkbox") {
      const checked = localValue === true;

      return (
        <div className="flex items-center gap-2">
          <Checkbox
            aria-describedby={statusId}
            checked={checked}
            id={controlId}
            onCheckedChange={(nextChecked) => save(nextChecked === true)}
          />
          <Label className="text-sm font-normal" htmlFor={controlId}>
            Confirm
          </Label>
        </div>
      );
    }

    if (kind === "multi_select") {
      const selectedValues = valueToStringArray(localValue);

      return (
        <div className="grid gap-2" aria-describedby={statusId}>
          {options.map((option) => {
            const checked = selectedValues.includes(option.value);

            return (
              <label
                className="flex items-center gap-2 text-sm"
                key={option.value}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(nextChecked) => {
                    const nextValues =
                      nextChecked === true
                        ? [...selectedValues, option.value]
                        : selectedValues.filter((value) => value !== option.value);

                    save(nextValues);
                  }}
                />
                {option.label}
              </label>
            );
          })}
        </div>
      );
    }

    if (kind === "textarea") {
      return (
        <Textarea
          aria-describedby={statusId}
          id={controlId}
          onBlur={() => save(localValue)}
          onChange={(event) => {
            setStatus("idle");
            setLocalValue(event.target.value);
          }}
          placeholder="Enter a considered response"
          value={valueToString(localValue)}
        />
      );
    }

    return (
      <Input
        aria-describedby={statusId}
        id={controlId}
        onBlur={() => save(localValue)}
        onChange={(event) => {
          setStatus("idle");
          setLocalValue(event.target.value);
        }}
        placeholder="Enter your response"
        type={kind}
        value={valueToString(localValue)}
      />
    );
  }

  return (
    <article className="rounded-lg border border-border p-4">
      <div className="space-y-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <Label className="text-base leading-6" htmlFor={controlId}>
            {question.questionText}
          </Label>
          <span className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
            Required
          </span>
        </div>
        {question.helpText ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {question.helpText}
          </p>
        ) : null}
      </div>

      <div className="mt-4">{renderControl()}</div>

      <p className="mt-3 text-xs text-muted-foreground" id={statusId}>
        {statusLabel({ isPending, status })}
      </p>
      {message ? (
        <Alert className="mt-3" variant="destructive">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
    </article>
  );
}
