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
  brandInstructionStarterTemplate,
  brandWideAgentValue,
} from "@/features/agents/instructions/schema";
import type {
  BrandAgentInstructionSlot,
  InstructionFormState,
} from "@/features/agents/instructions/types";

const initialState: InstructionFormState = { status: "idle", message: "" };

export function BrandInstructionForm({
  brandId,
  slot,
}: {
  brandId: string;
  slot: BrandAgentInstructionSlot;
}) {
  const [state, action, isPending] = useActionState(
    saveBrandAgentInstructionAction,
    initialState,
  );
  const [instruction, setInstruction] = useState(slot.instruction);
  const [isEnabled, setIsEnabled] = useState(slot.isEnabled);

  const isBrandWide = slot.agentId === null;
  const remaining = brandInstructionMaxLength - instruction.length;
  const fieldId = `instruction-${slot.agentId ?? "brand-wide"}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {slot.agentName}
          {isBrandWide ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Default
            </span>
          ) : null}
        </CardTitle>
        <CardDescription>
          {isBrandWide
            ? "Applies to every agent of this brand unless an agent has its own instruction below."
            : `Overrides the brand-wide default for ${slot.agentName}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-3">
          <input name="brandId" type="hidden" value={brandId} />
          <input
            name="agentId"
            type="hidden"
            value={slot.agentId ?? brandWideAgentValue}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={fieldId}>Instruction</Label>
              <Button
                className="gap-1.5"
                onClick={() => setInstruction(brandInstructionStarterTemplate)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <SparklesIcon className="size-3.5" />
                Insert template
              </Button>
            </div>
            <Textarea
              id={fieldId}
              maxLength={brandInstructionMaxLength}
              name="instruction"
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Brand voice, persona, do's and don'ts. Leave empty to use role + safety only."
              rows={8}
              value={instruction}
            />
            <p className="text-right text-xs text-muted-foreground">
              {remaining} characters left
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              checked={isEnabled}
              className="size-4"
              name="isEnabled"
              onChange={(event) => setIsEnabled(event.target.checked)}
              type="checkbox"
            />
            Enabled
          </label>

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
            {isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
