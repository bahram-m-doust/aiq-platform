import "server-only";

import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { IntakeSnapshotJson } from "@/features/intake/types";

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export async function generateIntakeDocx(
  snapshot: IntakeSnapshotJson,
): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      text: `Brand Intake — ${snapshot.brand.name}`,
      heading: HeadingLevel.TITLE,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Submitted: ${snapshot.submittedAt}`,
          italics: true,
          size: 20,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const section of snapshot.sections) {
    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_1,
      }),
    );

    for (const question of section.questions) {
      const answer = formatAnswerValue(question.answer.value);
      if (!answer) continue;

      children.push(
        new Paragraph({
          text: question.questionText,
          heading: HeadingLevel.HEADING_2,
        }),
      );
      children.push(new Paragraph({ text: answer }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
