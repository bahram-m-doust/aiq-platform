import { NextResponse } from "next/server";

import { requireUserProfile } from "@/features/auth/queries";
import {
  generateIntakeDocx,
  intakeDocxAsciiName,
  intakeDocxDisplayName,
} from "@/features/questionnaire/docx-generator";
import { getIntakeSnapshotForProfile } from "@/features/questionnaire/queries";
import { logServerError } from "@/lib/logging/server";

export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { profile } = await requireUserProfile("/integrated-brand-brain/roadmap/questionnaire");
  const { snapshotId } = await params;

  let snapshot: Awaited<ReturnType<typeof getIntakeSnapshotForProfile>>;
  try {
    snapshot = await getIntakeSnapshotForProfile({
      profileId: profile.id,
      snapshotId,
    });
  } catch (error) {
    logServerError({
      label: "[intake] snapshot download failed",
      error,
      metadata: { profileId: profile.id, snapshotId },
    });
    return NextResponse.json(
      { message: "Could not load the questionnaire export." },
      { status: 500 },
    );
  }

  // Null covers both "not found" and "not authorized"; do not disclose which.
  if (!snapshot) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const buffer = await generateIntakeDocx(snapshot.snapshotJson);

  const brandName = snapshot.snapshotJson.brand.name;
  // RFC 5987: ASCII `filename` fallback + UTF-8 `filename*` for Persian names.
  const asciiName = intakeDocxAsciiName(brandName);
  const displayName = intakeDocxDisplayName(brandName);
  const contentDisposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(displayName)}`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": contentDisposition,
      "Cache-Control": "no-store",
    },
  });
}
