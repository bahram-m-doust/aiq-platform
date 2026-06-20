import "server-only";

import type { ChangeRequestStatus } from "@/features/change-requests/types";
import type { AdminAccessKeyType } from "@/features/admin/types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAccessKeyRedeemPath({
  rawKey,
  type,
}: {
  rawKey: string;
  type: AdminAccessKeyType;
}) {
  const encoded = encodeURIComponent(rawKey.trim());
  return type === "JOIN_BRAND"
    ? `/invite/accept?key=${encoded}`
    : `/home?key=${encoded}`;
}

export function buildAccessKeyRedeemUrl({
  origin,
  rawKey,
  type,
}: {
  origin: string;
  rawKey: string;
  type: AdminAccessKeyType;
}) {
  const baseUrl = new URL(origin);
  return new URL(buildAccessKeyRedeemPath({ rawKey, type }), baseUrl).toString();
}

export function buildAccessKeyEmail({
  rawKey,
  redeemUrl,
  type,
  expiresAt,
}: {
  rawKey: string;
  redeemUrl: string;
  type: AdminAccessKeyType;
  expiresAt: string;
}) {
  const formattedExpiry = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(expiresAt));

  const subject = "Your Bextudio access key";
  const text = [
    "Your Bextudio access key is ready.",
    "",
    `Type: ${type}`,
    `Expires: ${formattedExpiry} UTC`,
    "",
    "Activate your access:",
    redeemUrl,
    "",
    "If the link does not work, paste this key manually:",
    rawKey,
  ].join("\n");

  const html = [
    "<p>Your Bextudio access key is ready.</p>",
    `<p><strong>Type:</strong> ${escapeHtml(type)}</p>`,
    `<p><strong>Expires:</strong> ${escapeHtml(formattedExpiry)} UTC</p>`,
    `<p><a href="${escapeHtml(redeemUrl)}">Activate your access</a></p>`,
    "<p>If the link does not work, paste this key manually:</p>",
    `<p><code>${escapeHtml(rawKey)}</code></p>`,
  ].join("");

  return { subject, text, html };
}

export function buildSpecialistInvitationEmail({
  acceptUrl,
  brandName,
  inviterEmail,
  expiresAt,
}: {
  acceptUrl: string;
  brandName: string;
  inviterEmail: string;
  expiresAt: string;
}) {
  const formattedExpiry = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(expiresAt));

  const subject = "You have been invited to a Bextudio Brand Workspace";
  const text = [
    `You have been invited to join ${brandName} on the Bextudio Platform as a Brand Specialist.`,
    `Invited by: ${inviterEmail}`,
    `Expires: ${formattedExpiry} UTC`,
    "",
    "Accept the invitation:",
    acceptUrl,
  ].join("\n");

  const html = [
    `<p>You have been invited to join <strong>${escapeHtml(
      brandName,
    )}</strong> on the Bextudio Platform as a Brand Specialist.</p>`,
    `<p><strong>Invited by:</strong> ${escapeHtml(inviterEmail)}</p>`,
    `<p><strong>Expires:</strong> ${escapeHtml(formattedExpiry)} UTC</p>`,
    `<p><a href="${escapeHtml(acceptUrl)}">Accept the invitation</a></p>`,
  ].join("");

  return { subject, text, html };
}

function changeRequestReviewLabel(status: ChangeRequestStatus) {
  switch (status) {
    case "UNDER_REVIEW":
      return "under review";
    case "APPROVED":
      return "approved";
    case "REJECTED":
      return "rejected";
    case "APPLIED":
      return "applied";
    case "CLOSED":
      return "closed";
    default:
      return "updated";
  }
}

function changeRequestReviewResultLine(status: ChangeRequestStatus) {
  if (status === "APPROVED") {
    return "Your questionnaire has been reopened for editing.";
  }

  return "You can view the result in your dashboard.";
}

export function buildChangeRequestReviewEmail({
  brandName,
  reviewUrl,
  resolutionNote,
  status,
}: {
  brandName: string;
  reviewUrl: string;
  resolutionNote: string | null;
  status: ChangeRequestStatus;
}) {
  const statusLabel = changeRequestReviewLabel(status);
  const subject = `Change request ${statusLabel}`;
  const text = [
    `Your change request for ${brandName} is now ${statusLabel}.`,
    resolutionNote ? `Reviewer note: ${resolutionNote}` : null,
    changeRequestReviewResultLine(status),
    "",
    "Open your dashboard to see the result:",
    reviewUrl,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  const html = [
    `<p>Your change request for <strong>${escapeHtml(brandName)}</strong> is now ${escapeHtml(statusLabel)}.</p>`,
    resolutionNote
      ? `<p><strong>Reviewer note:</strong> ${escapeHtml(resolutionNote)}</p>`
      : "",
    `<p>${escapeHtml(changeRequestReviewResultLine(status))}</p>`,
    `<p><a href="${escapeHtml(reviewUrl)}">Open your dashboard</a></p>`,
  ].join("");

  return { subject, text, html };
}
