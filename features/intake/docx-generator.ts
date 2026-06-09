import "server-only";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { IntakeSnapshotJson } from "@/features/intake/types";

// Persian-first export: right-to-left, IRANSansFaNum, 14pt body. Sizes are in
// half-points (28 = 14pt). Each question is a Heading 1 so answers are clearly
// separated and the document is navigable.
const FONT = "IRANSansFaNum";
const BODY_SIZE = 28; // 14pt
const QUESTION_SIZE = 32; // 16pt
const SECTION_SIZE = 36; // 18pt
const TITLE_SIZE = 48; // 24pt

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function rtlParagraph({
  text,
  size,
  bold = false,
  italics = false,
  heading,
  spacingBefore = 0,
}: {
  text: string;
  size: number;
  bold?: boolean;
  italics?: boolean;
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  spacingBefore?: number;
}): Paragraph {
  return new Paragraph({
    heading,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: spacingBefore ? { before: spacingBefore } : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        size,
        bold,
        italics,
        rightToLeft: true,
      }),
    ],
  });
}

export async function generateIntakeDocx(
  snapshot: IntakeSnapshotJson,
): Promise<Buffer> {
  const children: Paragraph[] = [
    rtlParagraph({
      text: `پرسشنامه برند — ${snapshot.brand.name}`,
      size: TITLE_SIZE,
      bold: true,
      heading: HeadingLevel.TITLE,
    }),
    rtlParagraph({
      text: `تاریخ ثبت: ${snapshot.submittedAt}`,
      size: 22,
      italics: true,
    }),
    rtlParagraph({ text: "", size: BODY_SIZE }),
  ];

  for (const section of snapshot.sections) {
    children.push(
      rtlParagraph({
        text: section.title,
        size: SECTION_SIZE,
        bold: true,
        heading: HeadingLevel.HEADING_2,
        spacingBefore: 240,
      }),
    );

    for (const question of section.questions) {
      const answer = formatAnswerValue(question.answer.value);
      if (!answer) continue;

      // Each question is a Heading 1 so answers are separated and navigable.
      children.push(
        rtlParagraph({
          text: question.questionText,
          size: QUESTION_SIZE,
          bold: true,
          heading: HeadingLevel.HEADING_1,
          spacingBefore: 160,
        }),
      );
      children.push(rtlParagraph({ text: answer, size: BODY_SIZE }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
