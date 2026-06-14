"use client";

import { useActionState, useMemo, useState } from "react";
import { BadgeCheckIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  createChangeRequestAction,
} from "@/features/change-requests/actions";
import {
  getQuestionOptions,
  initialCreateChangeRequestFormState,
} from "@/features/change-requests/schema";
import type {
  ChangeRequestCreateOptions,
  ChangeRequestTargetType,
} from "@/features/change-requests/types";
import { SubmitButton } from "@/features/auth/components/SubmitButton";

const targetTypeLabels: Record<ChangeRequestTargetType, string> = {
  INTAKE_SECTION: "Locked intake section",
  INTAKE_QUESTION: "Locked intake question",
  MODULE: "Module",
};

function defaultTargetType(
  options: ChangeRequestCreateOptions,
): ChangeRequestTargetType {
  if (options.intakeLocked) {
    return "INTAKE_SECTION";
  }

  return "INTAKE_SECTION";
}

export function ChangeRequestCreateForm({
  options,
}: {
  options: ChangeRequestCreateOptions;
}) {
  const [state, formAction] = useActionState(
    createChangeRequestAction,
    initialCreateChangeRequestFormState,
  );
  const [targetType, setTargetType] = useState<ChangeRequestTargetType>(
    defaultTargetType(options),
  );
  const questionOptions = useMemo(
    () => getQuestionOptions(options.sections),
    [options.sections],
  );
  const intakeTargetsDisabled = !options.intakeLocked;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Change Request</CardTitle>
          <CardDescription>
            Submit a reviewed correction request for {options.brandName}.
            Locked intake answers are not edited directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-5">
            {state.status === "error" ? (
              <Alert variant="destructive">
                <AlertDescription>{state.message}</AlertDescription>
              </Alert>
            ) : null}

            {!options.intakeLocked ? (
              <Alert>
                <AlertTitle>Intake not locked</AlertTitle>
                <AlertDescription>
                  Intake Change Requests become available only after Final
                  Submit locks the intake.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="target_type">Request target</Label>
                <Select
                  name="target_type"
                  onValueChange={(value) =>
                    setTargetType(value as ChangeRequestTargetType)
                  }
                  value={targetType}
                >
                  <SelectTrigger id="target_type">
                    <SelectValue placeholder="Select target type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      disabled={intakeTargetsDisabled}
                      value="INTAKE_SECTION"
                    >
                      {targetTypeLabels.INTAKE_SECTION}
                    </SelectItem>
                    <SelectItem
                      disabled={intakeTargetsDisabled}
                      value="INTAKE_QUESTION"
                    >
                      {targetTypeLabels.INTAKE_QUESTION}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === "INTAKE_SECTION" ? (
                <div className="space-y-2">
                  <Label htmlFor="section_key">Section</Label>
                  <Select disabled={intakeTargetsDisabled} name="section_key">
                    <SelectTrigger id="section_key">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.sections.map((section) => (
                        <SelectItem key={section.id} value={section.key}>
                          {section.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {targetType === "INTAKE_QUESTION" ? (
                <div className="space-y-2">
                  <Label htmlFor="question_target">Question</Label>
                  <Select
                    disabled={intakeTargetsDisabled}
                    name="question_target"
                  >
                    <SelectTrigger id="question_target">
                      <SelectValue placeholder="Select question" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionOptions.map((question) => (
                        <SelectItem
                          key={question.id}
                          value={`${question.sectionKey}:${question.id}`}
                        >
                          {question.sectionTitle}: {question.questionText}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <input name="module_id" type="hidden" value="" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Textarea
                  id="reason"
                  name="reason"
                  placeholder="Summarize why this correction is required"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Comment</Label>
                <Textarea
                  id="comment"
                  name="comment"
                  placeholder="Describe the requested correction for review"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end">
              <SubmitButton idleLabel="Request a Change" pendingLabel="Submitting" />
            </div>
          </form>
        </CardContent>
      </Card>

      {state.status === "success" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheckIcon className="size-4" />
              Change Request submitted
            </CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Request ID:{" "}
              <span className="font-mono text-foreground">
                {state.requestId}
              </span>
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
