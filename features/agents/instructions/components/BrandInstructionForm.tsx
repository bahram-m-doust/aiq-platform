"use client";

import { useActionState, useState } from "react";
import { CheckCircle2Icon, AlertCircleIcon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveBrandAgentInstructionAction } from "@/features/agents/instructions/actions";
import {
  brandInstructionMaxLength,
  buildBrandInstructionTemplate,
} from "@/features/agents/instructions/schema";
import type {
  BrandAgentInstructionSlot,
  InstructionFormState,
} from "@/features/agents/instructions/types";

const initialState: InstructionFormState = { status: "idle", message: "" };

export function BrandInstructionForm({
  brandId,
  brandName,
  slot,
}: {
  brandId: string;
  brandName: string;
  slot: BrandAgentInstructionSlot;
}) {
  const [state, action, isPending] = useActionState(
    saveBrandAgentInstructionAction,
    initialState,
  );
  const [draft, setDraft] = useState({
    brandId,
    sourceInstruction: slot.instruction,
    value: slot.instruction,
  });
  const isCurrentDraft =
    draft.brandId === brandId && draft.sourceInstruction === slot.instruction;
  const instruction = isCurrentDraft ? draft.value : slot.instruction;

  const remaining = brandInstructionMaxLength - instruction.length;
  const fieldId = "brand-prompt-text";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{slot.agentName}</CardTitle>
        <CardDescription>
          This prompt is sent as the OpenAI developer input text for this
          brand. File Search vector store routing is resolved by the server.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input name="brandId" type="hidden" value={brandId} />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={fieldId}>Prompt text</Label>
              <Button
                className="gap-1.5"
                onClick={() =>
                  setDraft({
                    brandId,
                    sourceInstruction: slot.instruction,
                    value: buildBrandInstructionTemplate({
                      brandName,
                    }),
                  })
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                <SparklesIcon className="size-3.5" />
                Insert template
              </Button>
            </div>
            <Textarea
              className="font-mono text-[13px] leading-relaxed"
              id={fieldId}
              maxLength={brandInstructionMaxLength}
              name="instruction"
              onChange={(event) =>
                setDraft({
                  brandId,
                  sourceInstruction: slot.instruction,
                  value: event.target.value,
                })
              }
              placeholder="Paste the same prompt text you would put in OpenAI Platform. This becomes the brand's developer input text."
              rows={18}
              value={instruction}
            />
            <p className="text-right text-xs text-muted-foreground">
              {remaining} characters left
            </p>
          </div>

          {state.status === "success" ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2Icon className="size-3.5" />
              {state.message}
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircleIcon className="size-3.5" />
              {state.message}
            </p>
          ) : null}

          <Button disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save prompt"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
