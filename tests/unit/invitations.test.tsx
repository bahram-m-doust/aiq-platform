import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/invitations/actions", () => ({
  createSpecialistInvitationAction: vi.fn(),
  acceptSpecialistInvitationAction: vi.fn(),
  initialSpecialistInvitationFormState: { status: "idle", message: "" },
  initialAcceptInvitationFormState: { status: "idle", message: "" },
}));

vi.mock("@/features/auth/actions", () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

import type { AccessKeySafeRecord } from "@/features/access/types";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { resolveTrustedAppOrigin } from "@/features/auth/origins";
import { buildSpecialistInvitationEmail } from "@/lib/email/templates";
import { AcceptInvitationForm } from "@/features/invitations/components/AcceptInvitationForm";
import { AcceptInvitationPrompt } from "@/features/invitations/components/AcceptInvitationPrompt";
import { SpecialistInvitationForm } from "@/features/invitations/components/SpecialistInvitationForm";
import {
  buildInvitationAcceptPath,
  buildInvitationAcceptUrl,
  canInviteSpecialistRole,
  toMemberInvitedAudit,
  toMemberJoinedAudit,
  validateJoinBrandAccessKey,
  validateSpecialistInvitationFormData,
} from "@/features/invitations/schema";
import type { SpecialistMembershipRecord } from "@/features/invitations/types";
import { withOriginEnv } from "@/tests/helpers/env";
import { formData } from "@/tests/helpers/formData";

const joinAccessKey: AccessKeySafeRecord = {
  id: "access-key-1",
  keyPrefix: "bext_secretpref",
  type: "JOIN_BRAND",
  status: "ACTIVE",
  targetEmail: "specialist@example.com",
  targetBrandId: "brand-1",
  targetRole: "BRAND_SPECIALIST",
  planId: null,
  maxRedemptions: 1,
  redeemedCount: 0,
  expiresAt: "2099-01-01T23:59:59.999Z",
  redeemedBy: null,
  redeemedAt: null,
  createdBy: "owner-1",
  createdAt: "2026-05-17T00:00:00.000Z",
  resendEmailId: null,
};

const membership: SpecialistMembershipRecord = {
  id: "membership-1",
  brandId: "brand-1",
  userId: "specialist-1",
  role: "BRAND_SPECIALIST",
  status: "ACTIVE",
  invitedBy: "owner-1",
};

describe("invitation validation", () => {
  it("normalizes invite form data and requires future expiry", () => {
    const result = validateSpecialistInvitationFormData(
      formData({
        target_email: " Specialist@Example.COM ",
        expires_at: "2099-01-01",
      }),
    );

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      targetEmail: "specialist@example.com",
      expiresAt: "2099-01-01T23:59:59.999Z",
    });

    expect(
      validateSpecialistInvitationFormData(
        formData({
          target_email: "not-an-email",
          expires_at: "2099-01-01",
        }),
      ).error,
    ).toBe("Enter a valid specialist email address.");
  });

  it("allows only Owner and Executive Manager to invite specialists", () => {
    expect(canInviteSpecialistRole("OWNER")).toBe(true);
    expect(canInviteSpecialistRole("EXECUTIVE_MANAGER")).toBe(true);
    expect(canInviteSpecialistRole("BRAND_SPECIALIST")).toBe(false);
    expect(canInviteSpecialistRole("REGISTERED_USER")).toBe(false);
  });

  it("validates JOIN_BRAND keys for Brand Specialist membership", () => {
    expect(validateJoinBrandAccessKey(joinAccessKey)).toBeNull();

    expect(
      validateJoinBrandAccessKey({
        ...joinAccessKey,
        type: "CLAIM_BRAND",
      })?.message,
    ).toBe("This invitation cannot join a brand workspace.");

    expect(
      validateJoinBrandAccessKey({
        ...joinAccessKey,
        targetRole: "OWNER",
      })?.message,
    ).toBe("This invitation is not configured for Brand Specialist access.");
  });

});

describe("invitation safe metadata and email", () => {
  it("keeps raw keys out of audit metadata", () => {
    const invitedAudit = toMemberInvitedAudit({
      accessKey: joinAccessKey,
      targetEmail: "specialist@example.com",
      deliveryStatus: "sent",
      resendEmailId: "email-1",
    });
    const joinedAudit = toMemberJoinedAudit({
      accessKey: joinAccessKey,
      membership,
    });
    const auditJson = JSON.stringify({ invitedAudit, joinedAudit });

    expect(auditJson).toContain("bext_secretpref");
    expect(auditJson).not.toContain("bext_raw_secret_key");
    expect(auditJson).not.toContain("key_hash");
  });

  it("builds an accept URL and keeps the raw key out of the subject", () => {
    const rawKey = "bext_raw_secret_key";
    const acceptPath = buildInvitationAcceptPath(rawKey);
    const acceptUrl = buildInvitationAcceptUrl({
      origin: "https://app.bextudio.test",
      rawKey,
    });
    const email = buildSpecialistInvitationEmail({
      acceptUrl,
      brandName: "Helio",
      inviterEmail: "owner@example.com",
      expiresAt: "2099-01-01T23:59:59.999Z",
    });

    expect(acceptPath).toBe("/invite/accept?key=bext_raw_secret_key");
    expect(acceptUrl).toBe(
      "https://app.bextudio.test/invite/accept?key=bext_raw_secret_key",
    );
    expect(email.subject).toBe(
      "You have been invited to an AIQ STUDIO Brand Workspace",
    );
    expect(email.subject).not.toContain(rawKey);
    expect(email.text).toContain(acceptUrl);
    expect(email.html).toContain("Accept the invitation");
  });

  it("builds invitation URLs from trusted origins only", () => {
    withOriginEnv(
      {
        appBaseUrl: "https://app.bextudio.test",
        adminBaseUrl: "https://admin.bextudio.test",
      },
      () => {
        const origin = resolveTrustedAppOrigin("https://attacker.example");
        const acceptUrl = buildInvitationAcceptUrl({
          origin,
          rawKey: "bext_raw_secret_key",
        });

        expect(origin).toBe("https://app.bextudio.test");
        expect(acceptUrl).toBe(
          "https://app.bextudio.test/invite/accept?key=bext_raw_secret_key",
        );
      },
    );
  });
});

describe("invitation components", () => {
  it("renders the owner specialist invite form", () => {
    render(
      <SpecialistInvitationForm
        context={{
          brandId: "brand-1",
          brandName: "Helio",
          membershipRole: "OWNER",
          planName: "ADVANCED",
        }}
      />,
    );

    expect(screen.getByText("Invite Brand Specialist")).toBeVisible();
    expect(screen.getByLabelText("Specialist email")).toBeVisible();
    expect(screen.getByLabelText("Invitation expiry")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Send invitation" }),
    ).toBeVisible();
  });

  it("renders the logged-out accept prompt with next-preserving links", () => {
    render(
      <AcceptInvitationPrompt acceptPath="/invite/accept?key=bext_raw_secret_key" />,
    );

    expect(screen.getByText("Accept invitation")).toBeVisible();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Finvite%2Faccept%3Fkey%3Dbext_raw_secret_key",
    );
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/register?next=%2Finvite%2Faccept%3Fkey%3Dbext_raw_secret_key",
    );
  });

  it("renders the accept form without visibly printing the raw key", () => {
    const { container } = render(
      <AcceptInvitationForm
        email="specialist@example.com"
        rawKey="bext_raw_secret_key"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Accept invitation" }),
    ).toBeVisible();
    expect(screen.queryByText("bext_raw_secret_key")).toBeNull();
    expect(container.querySelector("input[type='hidden']")).toHaveAttribute(
      "value",
      "bext_raw_secret_key",
    );
  });

  it("preserves invitation redirects from registration", () => {
    render(<RegisterForm nextPath="/invite/accept?key=bext_raw_secret_key" />);

    expect(
      screen.getAllByDisplayValue("/invite/accept?key=bext_raw_secret_key"),
    ).not.toHaveLength(0);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2Finvite%2Faccept%3Fkey%3Dbext_raw_secret_key",
    );
  });
});
