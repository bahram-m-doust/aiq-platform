"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircleIcon,
  CheckIcon,
  LoaderIcon,
  PencilIcon,
} from "lucide-react";

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
import { autosaveIntakeAnswerAction } from "@/features/intake/actions";
import type {
  AutosaveQuestionState,
  AutosaveQuestionStatus,
} from "@/features/intake/components/useIntakeAutosaveQueue";
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

function detectDir(value: IntakeAnswerValue): "rtl" | "ltr" {
  const text = typeof value === "string" ? value : "";
  if (!text) return "ltr";

  const rtlPattern =
    /[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/;
  return rtlPattern.test(text) ? "rtl" : "ltr";
}

function SaveIndicator({
  isPending,
  status,
  message,
  onRetry,
}: {
  isPending: boolean;
  status: AutosaveQuestionStatus;
  message?: string;
  onRetry?: () => void;
}) {
  if (isPending || status === "queued" || status === "saving") {
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
        {message || "Failed - tap to retry"}
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
  onQueuedChange,
  saveState,
  onRetryQueuedSave,
  requiredError = false,
  autosaveAction = autosaveIntakeAnswerAction,
}: {
  sessionId: string;
  question: IntakeQuestion;
  value: IntakeAnswerValue;
  onSaved?: (questionId: string, value: IntakeAnswerValue) => void;
  onQueuedChange?: (
    questionId: string,
    value: IntakeAnswerValue,
    options?: { flush?: boolean },
  ) => void;
  saveState?: AutosaveQuestionState;
  onRetryQueuedSave?: (questionId: string) => void;
  requiredError?: boolean;
  autosaveAction?: AutosaveAction;
}) {
  const [localValue, setLocalValue] = useState<IntakeAnswerValue>(value);
  const [status, setStatus] = useState<AutosaveQuestionStatus>("idle");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [lastSavedValue, setLastSavedValue] = useState<
    IntakeAnswerValue | undefined
  >(undefined);
  const [savedValue, setSavedValue] = useState<IntakeAnswerValue>(value);
  const [isEditing, setIsEditing] = useState(
    () => !isIntakeAnswerComplete(value),
  );
  // Text inputs hold their in-progress value locally while focused so typing
  // never triggers a save; we resync from the committed value only when the
  // field is not being edited (a restored draft or a completed save).
  const isFocusedRef = useRef(false);
  const kind = resolveQuestionInputKind(question.inputType);
  const options = useMemo(
    () => parseQuestionOptions(question.validationSchema),
    [question.validationSchema],
  );
  const controlId = `question-${question.id}`;
  const statusId = `${controlId}-status`;
  const usesQueuedAutosave = Boolean(onQueuedChange);
  const currentValue = usesQueuedAutosave ? value : localValue;

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value);
    }
  }, [value]);
  const displayedStatus = saveState?.status ?? status;
  const displayedMessage = saveState?.message ?? message;
  // Flagged by the parent on a finish attempt when this required answer is empty.
  const showRequiredError =
    requiredError && !isIntakeAnswerComplete(currentValue);

  function queueValue(nextValue: IntakeAnswerValue, flush = false) {
    onQueuedChange?.(question.id, nextValue, { flush });
  }

  function save(nextValue: IntakeAnswerValue) {
    setLastSavedValue(nextValue);

    if (onQueuedChange) {
      queueValue(nextValue);
      return;
    }

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
    if (onRetryQueuedSave) {
      onRetryQueuedSave(question.id);
      return;
    }

    if (lastSavedValue !== undefined) {
      save(lastSavedValue);
    }
  }

  function setTextValue(nextValue: string) {
    setStatus("idle");
    // Typing only updates the local draft — no save is queued until the field
    // loses focus, so the "Saving" indicator never flashes mid-keystroke.
    setLocalValue(nextValue);
  }

  function handleTextBlur() {
    isFocusedRef.current = false;

    if (onQueuedChange) {
      // Commit the local draft once, on blur (flush = save immediately).
      queueValue(localValue, true);
      return;
    }

    if (valueToString(localValue) === valueToString(savedValue)) return;
    save(localValue);
  }

  function handleDone() {
    const isTextKind =
      kind === "text" ||
      kind === "textarea" ||
      kind === "url" ||
      kind === "number";

    if (isTextKind) {
      handleTextBlur();
    }

    // Only collapse to the read-only "done" view when there is an actual
    // answer. For text fields the freshest value lives in the local draft
    // (the committed value updates a render later). An empty Done must keep
    // the field in edit mode.
    const committedValue = isTextKind ? localValue : currentValue;
    if (isIntakeAnswerComplete(committedValue)) {
      setIsEditing(false);
    }
  }

  function formatDisplay(): string | null {
    if (kind === "checkbox") {
      if (currentValue === true) return "Yes";
      if (currentValue === false) return "No";
      return null;
    }

    if (kind === "multi_select") {
      const values = valueToStringArray(currentValue);
      if (values.length === 0) return null;
      return values
        .map((item) => options.find((option) => option.value === item)?.label ?? item)
        .join(", ");
    }

    if (kind === "select" || kind === "radio") {
      const selectedValue = typeof currentValue === "string" ? currentValue : "";
      if (!selectedValue) return null;
      return (
        options.find((option) => option.value === selectedValue)?.label ??
        selectedValue
      );
    }

    const text = valueToString(currentValue).trim();
    return text.length > 0 ? text : null;
  }

  function renderControl() {
    if (kind === "select") {
      return (
        <Select
          onValueChange={(nextValue) => {
            if (!onQueuedChange) {
              setLocalValue(nextValue);
            }
            save(nextValue);
          }}
          value={typeof currentValue === "string" ? currentValue : undefined}
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
        <div
          aria-describedby={statusId}
          className="grid gap-2"
          role="radiogroup"
        >
          {options.map((option) => (
            <label
              className="flex items-center gap-2 text-sm"
              key={option.value}
            >
              <input
                checked={currentValue === option.value}
                className="size-4"
                name={controlId}
                onChange={() => {
                  if (!onQueuedChange) {
                    setLocalValue(option.value);
                  }
                  save(option.value);
                }}
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
      const checked = currentValue === true;

      return (
        <div className="flex items-center gap-2">
          <Checkbox
            aria-describedby={statusId}
            checked={checked}
            id={controlId}
            onCheckedChange={(nextChecked) => {
              const nextValue = nextChecked === true;
              if (!onQueuedChange) {
                setLocalValue(nextValue);
              }
              save(nextValue);
            }}
          />
          <Label className="text-sm font-normal" htmlFor={controlId}>
            Confirm
          </Label>
        </div>
      );
    }

    if (kind === "multi_select") {
      const selectedValues = valueToStringArray(currentValue);

      return (
        <div aria-describedby={statusId} className="grid gap-2">
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
                        : selectedValues.filter((item) => item !== option.value);

                    if (!onQueuedChange) {
                      setLocalValue(nextValues);
                    }
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
          aria-invalid={displayedStatus === "error" || showRequiredError}
          dir={detectDir(localValue)}
          id={controlId}
          onBlur={handleTextBlur}
          onChange={(event) => setTextValue(event.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          placeholder="Enter a considered response"
          value={valueToString(localValue)}
        />
      );
    }

    return (
      <Input
        aria-describedby={statusId}
        aria-invalid={displayedStatus === "error" || showRequiredError}
        dir={detectDir(localValue)}
        id={controlId}
        onBlur={handleTextBlur}
        onChange={(event) => setTextValue(event.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
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
        <Label
          className="text-sm font-medium leading-relaxed text-foreground"
          htmlFor={controlId}
        >
          {question.questionText}
        </Label>
        {question.helpText ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {question.helpText}
          </p>
        ) : null}
      </div>

      {isEditing ? (
        <>
          <div className="mt-3">{renderControl()}</div>

          {showRequiredError && (
            <p className="mt-1.5 text-xs text-destructive">
              This question needs an answer.
            </p>
          )}

          <div className="mt-2 flex min-h-[28px] items-center justify-between gap-2">
            <span aria-live="polite" id={statusId} role="status">
              <SaveIndicator
                isPending={isPending && !usesQueuedAutosave}
                message={displayedMessage}
                onRetry={retry}
                status={displayedStatus}
              />
            </span>
            <Button
              className="shrink-0"
              onClick={handleDone}
              size="sm"
              type="button"
              variant="outline"
            >
              <CheckIcon className="size-3.5" />
              Done
            </Button>
          </div>
        </>
      ) : (
        <>
          <div
            className="mt-3 rounded-[12px] border px-3.5 py-2.5 text-[13.5px] leading-6 whitespace-pre-wrap"
            dir={detectDir(currentValue)}
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

          <div className="mt-2 flex min-h-[28px] items-center justify-between gap-2">
            <span aria-live="polite" id={statusId} role="status">
              <SaveIndicator
                isPending={isPending && !usesQueuedAutosave}
                message={displayedMessage}
                onRetry={retry}
                status={displayedStatus}
              />
            </span>
            <Button
              className="shrink-0"
              onClick={() => setIsEditing(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
