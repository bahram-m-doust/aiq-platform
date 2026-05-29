"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";

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
import type { AgentCatalogItem } from "@/features/agents/catalog/types";
import {
  resolveAgentImageUrlsAction,
  runAgentAction,
} from "@/features/agents/runs/actions";
import {
  agentRunPromptMaxLength,
  initialAgentRunFormState,
} from "@/features/agents/runs/schema";
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_TEXT_MODEL,
  IMAGE_MODELS,
  TEXT_MODELS,
  type ImageModelId,
  type TextModelId,
} from "@/lib/openrouter/models";

function RunSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit">
      <SendIcon className="size-4" />
      {pending ? "Running agent" : "Run agent"}
    </Button>
  );
}

export function AgentRunPanel({
  agent,
  defaultTextModel,
  defaultImageModel,
}: {
  agent: AgentCatalogItem;
  defaultTextModel?: TextModelId;
  defaultImageModel?: ImageModelId;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(
    runAgentAction,
    initialAgentRunFormState,
  );
  const [textModel, setTextModel] = useState<TextModelId>(
    defaultTextModel ?? DEFAULT_TEXT_MODEL,
  );
  const [imageModel, setImageModel] = useState<ImageModelId>(
    defaultImageModel ?? DEFAULT_IMAGE_MODEL,
  );

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const lastResolvedRunIdRef = useRef<string | null>(null);
  const isImageAgent = agent.key === "IMAGE_GENERATOR";

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  useEffect(() => {
    const runId = state.runId ?? null;
    const paths = state.imagePaths ?? [];
    if (state.status !== "success") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrls([]);
      return;
    }
    if (
      !runId ||
      runId === lastResolvedRunIdRef.current ||
      paths.length === 0
    ) {
      return;
    }
    lastResolvedRunIdRef.current = runId;
    let cancelled = false;
    resolveAgentImageUrlsAction(paths).then((urls) => {
      if (cancelled) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImageUrls(urls);
    });
    return () => {
      cancelled = true;
    };
  }, [state.status, state.runId, state.imagePaths]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run {agent.name}</CardTitle>
        <CardDescription>
          The agent will use the approved knowledge base for the current brand.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form action={formAction} className="space-y-3">
          <input name="agent_key" type="hidden" value={agent.key} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="agent-text-model">Text model</Label>
              <select
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                id="agent-text-model"
                name="text_model"
                onChange={(e) => setTextModel(e.target.value as TextModelId)}
                style={{ borderColor: "var(--bv-line)" }}
                value={textModel}
              >
                {TEXT_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            {isImageAgent ? (
              <div className="space-y-2">
                <Label htmlFor="agent-image-model">Image model</Label>
                <select
                  className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                  id="agent-image-model"
                  name="image_model"
                  onChange={(e) =>
                    setImageModel(e.target.value as ImageModelId)
                  }
                  style={{ borderColor: "var(--bv-line)" }}
                  value={imageModel}
                >
                  {IMAGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-run-prompt">Request</Label>
            <Textarea
              id="agent-run-prompt"
              maxLength={agentRunPromptMaxLength}
              name="prompt"
              placeholder={
                isImageAgent
                  ? "Describe the image you want — subject, mood, composition. The text model will rewrite it on-brand before the image model renders it."
                  : "Enter a strategic request for this agent."
              }
              required
              rows={5}
            />
          </div>
          <RunSubmitButton />
        </form>

        {state.status === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        {state.status === "success" && state.answer ? (
          <section className="space-y-4 rounded-lg border border-border p-4">
            {imageUrls.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={`Generated image ${i + 1}`}
                    className="w-full rounded-[14px] border object-cover"
                    key={url}
                    src={url}
                    style={{ borderColor: "var(--bv-line)" }}
                  />
                ))}
              </div>
            ) : null}
            <div>
              <h2 className="text-base font-semibold">Latest response</h2>
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
  );
}
