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
import { autosaveIntakeAnswerAction } from "@/features/questionnaire/actions";
import type {
  AutosaveQuestionState,
  AutosaveQuestionStatus,
} from "@/features/questionnaire/components/useIntakeAutosaveQueue";
import {
  isIntakeAnswerComplete,
  parseQuestionOptions,
  resolveQuestionInputKind,
} from "@/features/questionnaire/schemas";
import type {
  AutosaveIntakeAnswerInput,
  AutosaveIntakeAnswerResult,
  IntakeAnswerValue,
  IntakeQuestion,
} from "@/features/questionnaire/types";
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
        Saving...
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground animate-in fade-in duration-300">
        <CheckIcon className="size-3" />
        Draft saved
      </span>
    );
  }

  if (status === "error") {
    return (
      <Button
        className="gap-1 text-xs text-destructive hover:text-destructive"
        onClick={onRetry}
        size="sm"
        type="button"
        variant="link"
      >
        <AlertCircleIcon className="size-3" />
        {message || "Failed - tap to retry"}
      </Button>
    );
  }

  return null;
}

function DoneIndicator() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
      <CheckIcon className="size-3" />
      Completed
    </span>
  );
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
  hidePrompt = false,
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
  hidePrompt?: boolean;
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
  const isTextKind =
    kind === "text" ||
    kind === "textarea" ||
    kind === "url" ||
    kind === "number";
  const completionValue = isTextKind ? localValue : currentValue;
  const canMarkDone =
    !question.isRequired || isIntakeAnswerComplete(completionValue);
  const committedTextValue = usesQueuedAutosave ? currentValue : savedValue;
  const hasUncommittedTextDraft =
    isTextKind &&
    valueToString(localValue) !== valueToString(committedTextValue);
  const hasAnswer = isIntakeAnswerComplete(completionValue);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const displayedStatus = saveState?.status ?? status;
  const displayedMessage = saveState?.message ?? message;
  const missingRequiredAnswer =
    question.isRequired && !hasAnswer;
  const indicatorStatus =
    displayedStatus === "saved" &&
    (hasUncommittedTextDraft || missingRequiredAnswer)
      ? "idle"
      : displayedStatus;
  // Flagged by the parent on a finish attempt when this required answer is empty.
  const showRequiredError =
    requiredError && missingRequiredAnswer;
  const hasValidationError = displayedStatus === "error" || showRequiredError;
  const showSaveProgress =
    isPending ||
    ["queued", "saving", "error"].includes(indicatorStatus);
  // While a draft autosave is in flight, "Save & mark done" is held disabled
  // so the in-progress write settles before the answer can be marked complete.
  const isSaving =
    (isPending && !usesQueuedAutosave) ||
    indicatorStatus === "queued" ||
    indicatorStatus === "saving";
  const markDoneLabel = canMarkDone
    ? isTextKind
      ? "Save & mark done"
      : "Mark as done"
    : "Done";

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

  // Moves focus to the next typeable field that comes after this question in the
  // DOM, so the user can keep typing without reaching for the mouse. Skips
  // already-answered (collapsed) questions, which render no input. Scheduled
  // after the current field collapses so the layout has settled.
  function focusNextTypeableField() {
    const card = document.getElementById(`question-card-${question.id}`);
    if (!card) return;
    const fields = Array.from(
      document.querySelectorAll<HTMLElement>("[data-intake-field]"),
    );
    const next = fields.find(
      (el) =>
        card.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
    if (next) {
      requestAnimationFrame(() => next.focus());
    }
  }

  // Keyboard fast-fill: Ctrl/Cmd+Enter jumps to the next questionnaire field
  // (focusing it blurs the current one, which autosaves), so the whole form can
  // be completed without the mouse. On a single-line input, plain Enter behaves
  // like pressing "Done" (save + advance). In a textarea, plain Enter stays a
  // newline. Tab still works as usual.
  function handleFieldKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) {
    if (event.key !== "Enter") return;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const fields = Array.from(
        document.querySelectorAll<HTMLElement>("[data-intake-field]"),
      );
      const index = fields.indexOf(event.currentTarget);
      const next = index >= 0 ? fields[index + 1] : undefined;
      if (next) {
        next.focus();
      } else {
        event.currentTarget.blur();
      }
      return;
    }

    // Plain Enter on a single-line input commits and advances; textarea keeps it.
    if (kind !== "textarea" && !event.shiftKey) {
      event.preventDefault();
      handleDone();
    }
  }

  function handleDone() {
    if (!canMarkDone) return;

    if (isTextKind) {
      handleTextBlur();
    }

    // Only collapse to the read-only "done" view when there is an actual
    // answer. For text fields the freshest value lives in the local draft
    // (the committed value updates a render later). An empty Done must keep
    // the field in edit mode.
    if (isIntakeAnswerComplete(completionValue)) {
      setIsEditing(false);
      focusNextTypeableField();
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
          aria-invalid={hasValidationError ? true : undefined}
          data-intake-field
          dir={detectDir(localValue)}
          id={controlId}
          onBlur={handleTextBlur}
          onChange={(event) => setTextValue(event.target.value)}
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onKeyDown={handleFieldKeyDown}
          placeholder="Enter a considered response"
          value={valueToString(localValue)}
        />
      );
    }

    return (
      <Input
        aria-describedby={statusId}
        aria-invalid={hasValidationError ? true : undefined}
        data-intake-field
        dir={detectDir(localValue)}
        id={controlId}
        onBlur={handleTextBlur}
        onChange={(event) => setTextValue(event.target.value)}
        onFocus={() => {
          isFocusedRef.current = true;
        }}
        onKeyDown={handleFieldKeyDown}
        placeholder="Enter your response"
        type={kind}
        value={valueToString(localValue)}
      />
    );
  }

  return (
    <div>
      <div className={hidePrompt ? "sr-only" : "space-y-1.5"}>
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
        <div>
          <div className={hidePrompt ? undefined : "mt-3"}>{renderControl()}</div>

          {showRequiredError && (
            <p
              className={cn(
                "text-xs text-destructive",
                hidePrompt ? "mt-2" : "mt-1.5",
              )}
            >
              This question needs an answer.
            </p>
          )}

          <div
            className={cn(
              "flex h-9 items-center justify-between gap-2",
              hidePrompt ? (showRequiredError ? "mt-3" : "mt-[17px]") : "mt-2",
            )}
          >
            <span aria-live="polite" id={statusId} role="status">
              <SaveIndicator
                isPending={isPending && !usesQueuedAutosave}
                message={displayedMessage}
                onRetry={retry}
                status={indicatorStatus}
              />
            </span>
            <Button
              className="h-9 shrink-0 rounded-full px-4 text-sm"
              disabled={!canMarkDone || isSaving}
              onClick={handleDone}
              onMouseDown={(event) => {
                // Clicking blurs the field, which fires a blur autosave and
                // would disable this button mid-press, swallowing the click.
                // Keep focus so handleDone runs the save itself instead.
                event.preventDefault();
              }}
              size="default"
              type="button"
              variant="outline"
            >
              <CheckIcon className="size-3.5" />
              {markDoneLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <div
            className={cn(
              "min-h-20 rounded-md border px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap shadow-xs",
              !hidePrompt && "mt-3",
            )}
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

          <div
            className={cn(
              "flex h-9 items-center justify-between gap-2",
              hidePrompt ? "mt-6" : "mt-2",
            )}
          >
            <span aria-live="polite" id={statusId} role="status">
              {showSaveProgress ? (
                <SaveIndicator
                  isPending={isPending && !usesQueuedAutosave}
                  message={displayedMessage}
                  onRetry={retry}
                  status={indicatorStatus}
                />
              ) : (
                <DoneIndicator />
              )}
            </span>
            <Button
              className="h-9 shrink-0 rounded-full px-4 text-sm"
              onClick={() => setIsEditing(true)}
              size="default"
              type="button"
              variant="outline"
            >
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
