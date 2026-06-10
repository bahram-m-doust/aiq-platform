"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  requirePlatformOwner,
  requireUserProfile,
} from "@/features/auth/queries";
import {
  createDemoRequest,
  isDemoRequestError,
  rejectDemoRequest,
} from "@/features/demo-requests/services";
import {
  readDemoRequestId,
  readResolutionNote,
  validateCreateDemoRequestFormData,
} from "@/features/demo-requests/schema";
import type {
  CreateDemoRequestFormState,
  ReviewDemoRequestFormState,
} from "@/features/demo-requests/types";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { logServerError } from "@/lib/logging/server";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";

function createErrorState(message: string): CreateDemoRequestFormState {
  return { status: "error", message };
}

function createSuccessState(message: string): CreateDemoRequestFormState {
  return { status: "success", message };
}

function reviewErrorState(message: string): ReviewDemoRequestFormState {
  return { status: "error", message };
}

function reviewSuccessState(message: string): ReviewDemoRequestFormState {
  return { status: "success", message };
}

function revalidateDemoRequestSurfaces() {
  revalidateTag(CACHE_TAGS.demoRequests, "max");
  revalidatePath("/admin");
  revalidatePath("/admin/demo-requests");
}

export async function createDemoRequestAction(
  _previousState: CreateDemoRequestFormState,
  formData: FormData,
): Promise<CreateDemoRequestFormState> {
  const { profile } = await requireUserProfile("/home");
  const rateLimit = await checkRequestRateLimit({
    bucket: "demo-requests.create",
    identifiers: [profile.id],
    limit: 3,
    windowSeconds: 60 * 60,
  });

  if (!rateLimit.allowed) {
    return createErrorState(RATE_LIMITED_MESSAGE);
  }

  const validation = validateCreateDemoRequestFormData(formData);

  if (validation.error) {
    return createErrorState(validation.error);
  }

  try {
    await createDemoRequest({ profile, message: validation.message });
    revalidateDemoRequestSurfaces();
    return createSuccessState(
      "Demo request submitted. Our team will reach out shortly.",
    );
  } catch (error) {
    if (isDemoRequestError(error)) {
      return createErrorState(error.message);
    }
    logServerError({ label: "[demo-requests]", error, metadata: { action: "create" } });
    return createErrorState("Demo request could not be submitted.");
  }
}

export async function rejectDemoRequestAction(
  _previousState: ReviewDemoRequestFormState,
  formData: FormData,
): Promise<ReviewDemoRequestFormState> {
  const { profile } = await requirePlatformOwner("/admin/demo-requests");
  const id = readDemoRequestId(formData);

  if (id.error || !id.id) {
    return reviewErrorState(id.error ?? "Missing demo request identifier.");
  }

  try {
    await rejectDemoRequest({
      demoRequestId: id.id,
      reviewer: profile,
      resolutionNote: readResolutionNote(formData),
    });
    revalidateDemoRequestSurfaces();
    return reviewSuccessState("Demo request rejected.");
  } catch (error) {
    if (isDemoRequestError(error)) {
      return reviewErrorState(error.message);
    }
    logServerError({ label: "[demo-requests]", error, metadata: { action: "reject" } });
    return reviewErrorState("Demo request could not be rejected.");
  }
}
