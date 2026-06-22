import "server-only";

import { retrieveBrandBrainContext } from "@/features/agents/brain/llm";
import { getBrandBrainWorkspace } from "@/features/agents/brain/queries";
import { getBrandAgentInstruction } from "@/features/agents/instructions/queries";
import { brandBrainProvider } from "@/features/agents/brain/schema";
import type { BrandBrainImageRunResult } from "@/features/agents/brain/types";
import type { UserProfile } from "@/features/auth/types";
import {
  createAgentImageSignedUrls,
  uploadAgentImagePng,
} from "@/features/agents/runs/image-storage";
import { rewritePromptForImage } from "@/features/agents/runs/llm";
import { getBrandModelDefaults } from "@/features/agents/runs/services";
import {
  attachRunUsage,
  recordRunUsage,
  withRunUsageReservation,
} from "@/features/openrouter/usage";
import { generateImage } from "@/lib/openrouter/image";
import { logAudit } from "@/lib/audit/logAudit";
import { DomainError, isDomainErrorWithCode } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE = "brand_brain_image_service";

export function isBrandBrainImageServiceError(
  error: unknown,
): error is DomainError {
  return isDomainErrorWithCode(error, CODE);
}

function imageError(message: string): never {
  throw new DomainError(CODE, message);
}

// The IMAGE_GENERATOR catalog agent supplies the per-agent instruction slot for
// image styling. If it is not configured we fall back to the brand agent id,
// which still resolves the brand-wide default.
async function resolveImageInstructionAgentId(
  fallbackAgentId: string,
): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("agents")
    .select("id")
    .eq("key", "IMAGE_GENERATOR")
    .maybeSingle<{ id: string }>();
  return data?.id ?? fallbackAgentId;
}

// In-chat image generation. Reuses the two-stage pipeline (on-brand prompt
// rewrite + image model) but persists the run under the Brand Brain agent so it
// rehydrates inside the same conversation thread. Gated by Brain readiness and
// budget — no separate IMAGE_GENERATOR entitlement is required here.
export async function runBrandBrainImage({
  profile,
  prompt,
}: {
  profile: UserProfile;
  prompt: string;
}): Promise<BrandBrainImageRunResult> {
  const workspace = await getBrandBrainWorkspace(profile.id);
  const { access, agent, readiness } = workspace;

  if (!access || !agent || !readiness.isReady) {
    imageError(readiness.message);
  }

  const brandId = access.brandId;
  const instructionAgentId = await resolveImageInstructionAgentId(agent.id);
  const instruction = await getBrandAgentInstruction({
    brandId,
    agentId: instructionAgentId,
  });

  // Bias retrieval toward visual-system chunks (colors, photography, composition)
  // so the image rewrite step gets the most relevant brand style rules.
  const visualQuery = `visual system color palette photography composition style ${prompt}`;
  const { context, retrievedSources, displaySources } =
    await retrieveBrandBrainContext({ prompt: visualQuery, brandId });
  const defaults = await getBrandModelDefaults(brandId);

  const startedAt = Date.now();
  const textStage = await withRunUsageReservation({
    brandId,
    kind: "TEXT",
    operation: async (reservation) => {
      const result = await rewritePromptForImage({
        brandId,
        brandPrompt: prompt,
        model: defaults.text,
        brandContext: context,
        instruction,
      });
      const usageId = await recordRunUsage({
        reservation,
        kind: "TEXT",
        model: result.usage.model,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        costCents: result.usage.costCents,
      });
      return { ...result, usageId };
    },
  });
  const { optimizedPrompt } = textStage;

  const imageStage = await withRunUsageReservation({
    brandId,
    kind: "IMAGE",
    operation: async (reservation) => {
      const result = await generateImage({
        brandId,
        model: defaults.image,
        prompt: optimizedPrompt,
        n: 1,
      });
      const usageId = await recordRunUsage({
        reservation,
        kind: "IMAGE",
        model: result.usage.model,
        imageCount: result.usage.imageCount,
        costCents: result.usage.costCents,
      });
      return { ...result, usageId };
    },
  });
  const { b64Images } = imageStage;
  const latencyMs = Math.max(0, Date.now() - startedAt);

  if (b64Images.length === 0) {
    imageError("Image model did not return any images.");
  }

  const answer = `Generated ${b64Images.length} image(s).`;
  const responseId = `image-${Date.now()}`;
  const admin = createAdminClient();

  // Insert first to obtain the run id, which scopes the storage path.
  const { data: inserted, error: insertError } = await admin
    .from("agent_runs")
    .insert({
      brand_id: brandId,
      agent_id: agent.id,
      user_id: profile.id,
      input: { prompt, mode: "image" },
      output: { answer, response_id: responseId },
      provider: brandBrainProvider,
      model: defaults.image,
      retrieved_sources: retrievedSources,
      cost: null,
      latency_ms: latencyMs,
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  const runId = (inserted as { id: string }).id;

  const imagePaths: string[] = [];
  for (let i = 0; i < b64Images.length; i += 1) {
    const storagePath = `${brandId}/${runId}/${i}.png`;
    await uploadAgentImagePng({
      storagePath,
      pngBytes: Buffer.from(b64Images[i], "base64"),
    });
    imagePaths.push(storagePath);
  }

  const { error: outputError } = await admin
    .from("agent_runs")
    .update({
      output: {
        answer,
        response_id: responseId,
        image_prompt: optimizedPrompt,
        image_paths: imagePaths,
        text_model: defaults.text,
      },
    })
    .eq("id", runId);
  if (outputError) {
    throw outputError;
  }

  await attachRunUsage({
    runId,
    usageIds: [textStage.usageId, imageStage.usageId],
  });

  await logAudit({
    actorUserId: profile.id,
    actorRole: profile.global_role,
    brandId,
    action: "agent_run_created",
    entityType: "agent_run",
    entityId: runId,
    before: null,
    after: {
      brand_id: brandId,
      agent_id: agent.id,
      run_id: runId,
      mode: "image",
      model: defaults.image,
    },
  });

  const images = await createAgentImageSignedUrls(imagePaths);

  return { runId, optimizedPrompt, images, sources: displaySources };
}
