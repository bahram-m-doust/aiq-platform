import { NextResponse } from "next/server";

import { requireUserProfile } from "@/features/auth/queries";
import {
  computeBrainUsage,
  isLLMBrainConfigError,
  openBrandBrainStream,
} from "@/features/agents/brain/llm";
import {
  normalizeBrandBrainHistory,
  validateBrandBrainPrompt,
} from "@/features/agents/brain/schema";
import {
  finalizeBrandBrainRun,
  isBrandBrainServiceError,
  prepareBrandBrainStream,
} from "@/features/agents/brain/services";
import type { BrandBrainStreamEvent } from "@/features/agents/brain/types";
import { isBudgetExceededError } from "@/features/openrouter/usage";
import { releaseRunUsageReservation } from "@/features/openrouter/usage";
import { logServerError } from "@/lib/logging/server";
import { providerCostCents } from "@/lib/openrouter/models";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";
import { ROUTES } from "@/lib/routes";

export const dynamic = "force-dynamic";

const ENCODER = new TextEncoder();

function encodeEvent(event: BrandBrainStreamEvent): Uint8Array {
  return ENCODER.encode(`${JSON.stringify(event)}\n`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const { profile } = await requireUserProfile(ROUTES.brain);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Brand Brain request body is invalid." },
      { status: 400 },
    );
  }

  const payload = isRecord(body) ? body : {};
  const validation = validateBrandBrainPrompt(payload.prompt);

  if (validation.error || !validation.prompt) {
    return NextResponse.json(
      { message: validation.error ?? "Brand Brain prompt is invalid." },
      { status: 400 },
    );
  }

  const rateLimit = await checkRequestRateLimit({
    bucket: "brain.run",
    identifiers: [profile.id],
    limit: 20,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ message: RATE_LIMITED_MESSAGE }, { status: 429 });
  }

  const prompt = validation.prompt;
  const history = normalizeBrandBrainHistory(payload.history);
  const sessionId = typeof payload.sessionId === "string" && payload.sessionId.length > 0
    ? payload.sessionId
    : null;

  // Gate, budget-check, and retrieve before opening the stream so access errors
  // surface as a normal HTTP status the client can show inline.
  let plan;
  try {
    plan = await prepareBrandBrainStream({ profile, prompt, history });
  } catch (error) {
    if (
      isBudgetExceededError(error) ||
      isBrandBrainServiceError(error) ||
      isLLMBrainConfigError(error)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    logServerError({
      label: "[brand-brain] stream prepare failed",
      error,
      metadata: { profileId: profile.id },
    });
    return NextResponse.json(
      { message: "Brand Brain could not complete this request." },
      { status: 500 },
    );
  }

  const providerAbort = new AbortController();
  request.signal.addEventListener("abort", () => providerAbort.abort(), {
    once: true,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let promptTokens = 0;
      let completionTokens = 0;
      let responseId = "";
      let providerUsage: unknown = null;

      try {
        const completion = await openBrandBrainStream({
          brandId: plan.brandId,
          model: plan.model,
          messages: plan.messages,
          signal: providerAbort.signal,
        });

        for await (const chunk of completion) {
          if (chunk.id) {
            responseId = chunk.id;
          }

          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            answer += delta;
            controller.enqueue(encodeEvent({ type: "delta", text: delta }));
          }

          if (chunk.usage) {
            providerUsage = chunk.usage;
            promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
            completionTokens = chunk.usage.completion_tokens ?? completionTokens;
          }
        }

        const trimmedAnswer = answer.trim();
        if (!trimmedAnswer) {
          await releaseRunUsageReservation(plan.reservation).catch(
            () => undefined,
          );
          controller.enqueue(
            encodeEvent({
              type: "error",
              message: "Brand Brain did not return an answer.",
            }),
          );
          controller.close();
          return;
        }

        // Persist only after the answer is fully streamed so the stored run,
        // usage ledger, and audit trail match what the user actually received.
        const estimatedUsage = computeBrainUsage({
          model: plan.model,
          promptTokens,
          completionTokens,
        });
        const runId = await finalizeBrandBrainRun({
          profile,
          brandId: plan.brandId,
          agentId: plan.agentId,
          model: plan.model,
          prompt,
          answer: trimmedAnswer,
          responseId: responseId || `pgvector-${Date.now()}`,
          retrievedSources: plan.retrievedSources,
          usage: {
            ...estimatedUsage,
            costCents: providerCostCents(
              providerUsage,
              estimatedUsage.costCents,
            ),
          },
          reservation: plan.reservation,
          latencyMs: Math.max(0, Date.now() - plan.startedAt),
          sessionId,
        });

        controller.enqueue(
          encodeEvent({
            type: "done",
            runId,
            sources: plan.displaySources,
          }),
        );
        controller.close();
      } catch (error) {
        await releaseRunUsageReservation(plan.reservation).catch(
          () => undefined,
        );
        logServerError({
          label: "[brand-brain] stream failed",
          error,
          metadata: { profileId: profile.id },
        });
        controller.enqueue(
          encodeEvent({
            type: "error",
            message: "Brand Brain could not complete this request.",
          }),
        );
        controller.close();
      }
    },
    cancel() {
      providerAbort.abort();
      void releaseRunUsageReservation(plan.reservation).catch(() => undefined);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
