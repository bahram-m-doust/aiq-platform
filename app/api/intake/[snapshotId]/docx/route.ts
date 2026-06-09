import { NextResponse } from "next/server";

import { requireUserProfile } from "@/features/auth/queries";
import { generateIntakeDocx } from "@/features/intake/docx-generator";
import { getIntakeSnapshotForProfile } from "@/features/intake/queries";
import { logServerError } from "@/lib/logging/server";

export const dynamic = "force-dynamic";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ snapshotId: string }> },
) {
  const { profile } = await requireUserProfile("/dashboard/questionnaire");
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

  // Null covers both "not found" and "not authorized" — don't disclose which.
  if (!snapshot) {
    return NextResponse.json({ message: "Not found." }, { status: 404 });
  }

  const buffer = await generateIntakeDocx(snapshot.snapshotJson);

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": 'attachment; filename="Brand-Intake.docx"',
      "Cache-Control": "no-store",
    },
  });
}
