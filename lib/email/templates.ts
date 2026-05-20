import "server-only";

import type { AdminAccessKeyType } from "@/features/admin/types";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildAccessKeyEmail({
  rawKey,
  type,
  expiresAt,
}: {
  rawKey: string;
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
    rawKey,
  ].join("\n");

  const html = [
    "<p>Your Bextudio access key is ready.</p>",
    `<p><strong>Type:</strong> ${escapeHtml(type)}</p>`,
    `<p><strong>Expires:</strong> ${escapeHtml(formattedExpiry)} UTC</p>`,
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
