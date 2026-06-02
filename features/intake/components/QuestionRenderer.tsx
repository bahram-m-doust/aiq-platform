"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckIcon,
  AlertCircleIcon,
  LoaderIcon,
  PencilIcon,
} from "lucide-react";

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
  isIntakeAnswerComplete,
  parseQuestionOptions,
  resolveQuestionInputKind,
} from "@/features/intake/schemas";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  IntakeAnswerValue,
  IntakeQuestion,
} from "@/features/intake/types";
import { cn } from "@/lib/utils";

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

// Detect RTL script (Arabic, Persian, Hebrew) — returns "rtl" or "ltr"
function detectDir(value: IntakeAnswerValue): "rtl" | "ltr" {
  const text = typeof value === "string" ? value : "";
  if (!text) return "ltr";
  // Match Arabic, Persian, Hebrew character ranges
  // eslint-disable-next-line no-misleading-character-class
  const rtlPattern = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;
  return rtlPattern.test(text) ? "rtl" : "ltr";
}

function SaveIndicator({
  isPending,
  status,
  onRetry,
}: {
  isPending: boolean;
  status: "idle" | "saved" | "error";
  onRetry?: () => void;
}) {
  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--bv-accent)]">
        <LoaderIcon className="size-3 animate-spin" />
        Saving
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 animate-in fade-in duration-300">
        <CheckIcon className="size-3" />
        Saved
      </span>
    );
  }

  if (status === "error") {
    return (
      <button
        className="inline-flex items-center gap-1 text-xs text-destructive transition-colors hover:underline"
        onClick={onRetry}
        type="button"
      >
        <AlertCircleIcon className="size-3" />
        Failed — tap to retry
      </button>
    );
  }

  return null;
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
  const [lastSavedValue, setLastSavedValue] = useState<unknown>(null);
  // Baseline of the last persisted value, so blur doesn't re-save an
  // unchanged field (e.g. focusing then leaving without typing).
  const [savedValue, setSavedValue] = useState<IntakeAnswerValue>(value);
  // Hybrid edit model: answered questions collapse to a read-only view with
  // an Edit button. Answers still autosave under the hood (on blur / change).
  const [isEditing, setIsEditing] = useState(() => !isIntakeAnswerComplete(value));
  const kind = resolveQuestionInputKind(question.inputType);
  const options = useMemo(
    () => parseQuestionOptions(question.validationSchema),
    [question.validationSchema],
  );
  const controlId = `question-${question.id}`;
  const statusId = `${controlId}-status`;

  function save(nextValue: unknown) {
    setLastSavedValue(nextValue);
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
      setSavedValue(result.value);
      setStatus("saved");
      setMessage("");
      onSaved?.(question.id, result.value);
    });
  }

  function retry() {
    if (lastSavedValue !== null) {
      save(lastSavedValue);
    }
  }

  // For free-text inputs, only autosave on blur when the value actually
  // changed from what's already persisted — avoids saving an untouched field.
  function handleTextBlur() {
    if (valueToString(localValue) === valueToString(savedValue)) return;
    save(localValue);
  }

  // Collapse the question back to its read-only view. Text fields have already
  // autosaved on blur (clicking Done blurs the field first); choice controls
  // save on change — so Done only needs to switch the view.
  function handleDone() {
    setIsEditing(false);
  }

  // Human-readable rendering of the current answer for the read-only view.
  function formatDisplay(): string | null {
    if (kind === "checkbox") {
      if (localValue === true) return "Yes";
      if (localValue === false) return "No";
      return null;
    }
    if (kind === "multi_select") {
      const values = valueToStringArray(localValue);
      if (values.length === 0) return null;
      return values
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    if (kind === "select" || kind === "radio") {
      const v = typeof localValue === "string" ? localValue : "";
      if (!v) return null;
      return options.find((o) => o.value === v)?.label ?? v;
    }
    const text = valueToString(localValue).trim();
    return text.length > 0 ? text : null;
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
                        : selectedValues.filter((v) => v !== option.value);

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
          aria-invalid={status === "error"}
          dir={detectDir(localValue)}
          id={controlId}
          onBlur={handleTextBlur}
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
        aria-invalid={status === "error"}
        dir={detectDir(localValue)}
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
    <div>
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <Label className="text-sm font-medium leading-relaxed" htmlFor={controlId}>
            {question.questionText}
          </Label>
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
            Required
          </span>
        </div>
        {question.helpText ? (
          <p className="text-xs leading-relaxed text-[var(--bv-ink-3)]">
            {question.helpText}
          </p>
        ) : null}
      </div>

      {isEditing ? (
        <>
          <div className="mt-3">{renderControl()}</div>

          <div className="mt-2 flex min-h-[28px] items-center justify-between gap-2">
            <span id={statusId} role="status" aria-live="polite">
              <SaveIndicator
                isPending={isPending}
                onRetry={retry}
                status={status}
              />
            </span>
            <button
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-[var(--bv-ink-2)] transition-colors hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
              onClick={handleDone}
              style={{ borderColor: "var(--bv-line)" }}
              type="button"
            >
              <CheckIcon className="size-3.5" />
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <div
            className="mt-3 rounded-[12px] border px-3.5 py-2.5 text-[13.5px] leading-6 whitespace-pre-wrap"
            style={{
              background: "var(--bv-card-soft)",
              borderColor: "var(--bv-line)",
              color: formatDisplay()
                ? "var(--bv-ink-2)"
                : "var(--bv-ink-4)",
            }}
          >
            {formatDisplay() ?? "No answer yet"}
          </div>

          <div className="mt-2 flex items-center justify-end">
            <button
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] text-[var(--bv-ink-2)] transition-colors hover:border-[var(--bv-line-2)] hover:text-[var(--bv-ink)]"
              onClick={() => setIsEditing(true)}
              style={{ borderColor: "var(--bv-line)" }}
              type="button"
            >
              <PencilIcon className="size-3.5" />
              Edit
            </button>
          </div>
        </>
      )}
    </div>
  );
}
