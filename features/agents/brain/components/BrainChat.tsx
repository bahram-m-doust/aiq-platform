"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  AlertCircleIcon,
  BrainIcon,
  LoaderIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";

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
    <Button className="gap-2" disabled={pending} type="submit">
      {pending ? (
        <>
          <LoaderIcon className="size-4 animate-spin" />
          Thinking...
        </>
      ) : (
        <>
          <SendIcon className="size-4" />
          Ask Brand Brain
        </>
      )}
    </Button>
  );
}

function ThinkingSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function BrainChat({ access }: { access: BrandBrainAccess }) {
  const [state, formAction] = useActionState(
    askBrandBrainAction,
    initialBrandBrainChatFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const hasResult = state.status === "success" || state.status === "error";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainIcon className="size-5" />
              Brand Brain
            </CardTitle>
            <CardDescription>
              Ask strategic questions against the approved knowledge base for{" "}
              {access.brandName}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={formAction} className="space-y-3" ref={formRef}>
              <div className="space-y-2">
                <Label htmlFor="brand-brain-prompt">Question</Label>
                <Textarea
                  id="brand-brain-prompt"
                  maxLength={brandBrainPromptMaxLength}
                  name="prompt"
                  placeholder="Ask Brand Brain for a strategic summary, implication, or recommendation."
                  required
                  rows={4}
                />
              </div>
              <SubmitButton />
            </form>

            <PendingAnswer />

            {state.status === "error" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive">
                      Unable to process question
                    </p>
                    <p className="text-xs text-[var(--bv-ink-3)]">
                      {state.message}
                    </p>
                    <Button
                      className="gap-1.5"
                      onClick={() => formRef.current?.requestSubmit()}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <RefreshCwIcon className="size-3" />
                      Try again
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {state.status === "success" && state.answer ? (
              <section className="space-y-4 rounded-lg border border-border bg-[var(--bv-card-soft)] p-4">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--bv-ink)]">Answer</h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--bv-ink-2)]">
                    {state.answer}
                  </p>
                </div>
                {state.sources && state.sources.length > 0 ? (
                  <div className="space-y-1.5 border-t border-dashed pt-3" style={{ borderColor: "var(--bv-line-dashed)" }}>
                    <h3 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--bv-ink-4)]">
                      Sources
                    </h3>
                    <ul className="space-y-1 text-xs text-[var(--bv-ink-3)]">
                      {state.sources.map((source) => (
                        <li key={`${source.fileName}-${source.score ?? "source"}`}>
                          {source.fileName}
                          {source.score !== null
                            ? ` · ${Math.round(source.score * 100)}%`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {!hasResult && (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div
                  className="flex size-14 items-center justify-center rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--bv-brand-tint-16), var(--bv-brand-tint-8))",
                    color: "var(--bv-brand-deep)",
                    boxShadow: "0 0 0 1px var(--bv-brand-tint-16)",
                  }}
                >
                  <BrainIcon className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <p className="ds-h3">Ask anything about {access.brandName}</p>
                  <p className="ds-caption max-w-md">
                    Brand Brain searches your knowledge base and responds with sources.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Scope</CardTitle>
          <CardDescription>
            Restricted to {access.brandName} knowledge.
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

function PendingAnswer() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <ThinkingSkeleton />;
}
