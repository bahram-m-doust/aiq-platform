"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { BrainIcon, SendIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  askBrandBrainAction,
} from "@/features/agents/brain/actions";
import {
  brandBrainPromptMaxLength,
  initialBrandBrainChatFormState,
} from "@/features/agents/brain/schema";
import type { BrandBrainAccess } from "@/features/agents/brain/types";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      <SendIcon className="size-4" />
      {pending ? "Thinking" : "Ask Brand Brain"}
    </Button>
  );
}

export function BrainChat({ access }: { access: BrandBrainAccess }) {
  const [state, formAction] = useActionState(
    askBrandBrainAction,
    initialBrandBrainChatFormState,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BrainIcon className="size-5" />
            Brand Integrator Brain
          </CardTitle>
          <CardDescription>
            Ask strategic questions against the approved knowledge base for{" "}
            {access.brandName}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={formAction} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="brand-brain-prompt">Question</Label>
              <Textarea
                id="brand-brain-prompt"
                maxLength={brandBrainPromptMaxLength}
                name="prompt"
                placeholder="Ask Brand Brain for a strategic summary, implication, or recommendation."
                required
                rows={6}
              />
            </div>
            <SubmitButton />
          </form>

          {state.status === "error" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          {state.status === "success" && state.answer ? (
            <section className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <h2 className="text-base font-semibold">Answer</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {state.answer}
                </p>
              </div>
              {state.sources && state.sources.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Sources</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {state.sources.map((source) => (
                      <li key={`${source.fileName}-${source.score ?? "source"}`}>
                        {source.fileName}
                        {source.score !== null
                          ? ` (${Math.round(source.score * 100)}%)`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Workspace scope</CardTitle>
          <CardDescription>
            Brand Brain is restricted to the current brand knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Brand</dt>
              <dd className="font-medium">{access.brandName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{access.membershipRole}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-medium">{access.planName ?? "Active"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
