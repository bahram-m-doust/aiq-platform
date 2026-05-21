import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITED_MESSAGE: "Too many attempts. Please try again later.",
  checkRequestRateLimit: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  requireUserProfile: vi.fn(),
}));

vi.mock("@/features/auth/profile", () => ({
  describeProfileProvisioningError: vi.fn(() => "safe profile error"),
  ensureUserProfile: vi.fn(),
  logProfileProvisioningError: vi.fn(),
}));

vi.mock("@/features/auth/origins", () => ({
  getTrustedRequestOrigin: vi.fn(() => Promise.resolve("https://app.test")),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/features/access/services", () => ({
  redeemAccessKey: vi.fn(),
}));

vi.mock("@/features/brands/claim-brand/services", () => ({
  claimBrandForRedeemedAccessKey: vi.fn(),
  validateClaimBrandBeforeRedeem: vi.fn(),
}));

vi.mock("@/features/invitations/services", () => ({
  acceptSpecialistInvitationForRedeemedAccessKey: vi.fn(),
  createSpecialistInvitation: vi.fn(),
  isInvitationError: vi.fn(() => false),
  validateJoinBrandBeforeRedeem: vi.fn(),
}));

vi.mock("@/features/files/services", () => ({
  createSignedDownloadUrlForFile: vi.fn(),
  isFileServiceError: vi.fn(() => false),
  reviewSpecialistFile: vi.fn(),
  uploadBrandFileFromFormData: vi.fn(),
}));

vi.mock("@/features/agents/brain/openai", () => ({
  isOpenAIBrainConfigError: vi.fn(() => false),
}));

vi.mock("@/features/agents/brain/services", () => ({
  isBrandBrainServiceError: vi.fn(() => false),
  runBrandBrain: vi.fn(),
}));

vi.mock("@/features/agents/runs/openai", () => ({
  isOpenAIAgentRunConfigError: vi.fn(() => false),
}));

vi.mock("@/features/agents/runs/services", () => ({
  isAgentRunServiceError: vi.fn(() => false),
  runCatalogAgent: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

import { askBrandBrainAction } from "@/features/agents/brain/actions";
import { runAgentAction } from "@/features/agents/runs/actions";
import { redeemDashboardAccessKeyAction } from "@/features/access/actions";
import { login } from "@/features/auth/actions";
import { requireUserProfile } from "@/features/auth/queries";
import { uploadFileAction } from "@/features/files/actions";
import { uploadBrandFileFromFormData } from "@/features/files/services";
import { createSpecialistInvitationAction } from "@/features/invitations/actions";
import { createSpecialistInvitation } from "@/features/invitations/services";
import {
  checkRequestRateLimit,
  RATE_LIMITED_MESSAGE,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { redeemAccessKey } from "@/features/access/services";
import { runBrandBrain } from "@/features/agents/brain/services";
import { runCatalogAgent } from "@/features/agents/runs/services";
import { formData } from "@/tests/helpers/formData";

const mockedCheckRequestRateLimit = vi.mocked(checkRequestRateLimit);
const mockedRequireUserProfile = vi.mocked(requireUserProfile);

describe("action rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRequestRateLimit.mockResolvedValue({
      allowed: false,
      bucket: "auth.login",
      count: 11,
      limit: 10,
      resetAt: new Date("2026-05-22T12:35:00.000Z"),
    });
    mockedRequireUserProfile.mockResolvedValue({
      user: { email: "owner@example.com" },
      profile: {
        id: "profile-1",
        auth_user_id: "auth-1",
        email: "owner@example.com",
        full_name: null,
        global_role: "REGISTERED_USER",
      },
    } as never);
  });

  it("stops login before Supabase auth when rate limited", async () => {
    const result = await login(
      { status: "idle", message: "" },
      formData({ email: "owner@example.com", password: "password123" }),
    );

    expect(result).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("stops access key redemption before redeeming the raw key", async () => {
    const result = await redeemDashboardAccessKeyAction(
      { status: "idle", message: "" },
      formData({ accessKey: "bext_raw_secret_key" }),
    );

    expect(result).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
    expect(redeemAccessKey).not.toHaveBeenCalled();
  });

  it("stops invitation creation before creating an access key", async () => {
    const result = await createSpecialistInvitationAction(
      { status: "idle", message: "" },
      formData({
        target_email: "specialist@example.com",
        expires_at: "2099-01-01",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
    expect(createSpecialistInvitation).not.toHaveBeenCalled();
  });

  it("stops file upload before storage work", async () => {
    const result = await uploadFileAction(
      { status: "idle", message: "" },
      formData({
        file: new File(["hello"], "brief.pdf", { type: "application/pdf" }),
        visibility: "BRAND_TEAM",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
    expect(uploadBrandFileFromFormData).not.toHaveBeenCalled();
  });

  it("stops Brand Brain and agent runs before OpenAI work", async () => {
    const brainResult = await askBrandBrainAction(
      { status: "idle", message: "" },
      formData({ prompt: "Summarize the strategy." }),
    );
    const agentResult = await runAgentAction(
      { status: "idle", message: "" },
      formData({
        agent_key: "story-teller",
        prompt: "Build the campaign story.",
      }),
    );

    expect(brainResult).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
    expect(agentResult).toEqual({
      status: "error",
      message: RATE_LIMITED_MESSAGE,
    });
    expect(runBrandBrain).not.toHaveBeenCalled();
    expect(runCatalogAgent).not.toHaveBeenCalled();
  });
});
