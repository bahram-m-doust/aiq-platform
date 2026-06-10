import "server-only";

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { IntakeSnapshotJson } from "@/features/questionnaire/types";

// English export: left-to-right, left-aligned, IRANSansFaNum, 14pt body. Sizes
// are in half-points (28 = 14pt). Section titles (Company, Context, …) are
// Heading 1, each question is a Heading 2, and answers are normal body text —
// so the document is navigable and everything is aligned to the left.
const FONT = "IRANSansFaNum";
const BODY_SIZE = 28; // 14pt
const QUESTION_SIZE = 32; // 16pt
const SECTION_SIZE = 36; // 18pt
const TITLE_SIZE = 48; // 24pt

// Strip characters illegal in filenames / storage keys and collapse whitespace.
function sanitizeBrandName(brandName: string): string {
  return brandName
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Human-facing download/display name, e.g. `Onmind Questionnaire.docx`. Keeps
// non-ASCII (Persian) brand names intact for the visible filename.
export function intakeDocxDisplayName(brandName: string): string {
  const clean = sanitizeBrandName(brandName);
  return `${clean ? `${clean} ` : ""}Questionnaire.docx`;
}

// ASCII-only variant for HTTP header fallback and storage keys. A fully Persian
// brand name collapses to just `Questionnaire.docx` (the brandId/fileId path
// prefix keeps storage keys unique).
export function intakeDocxAsciiName(brandName: string): string {
  const clean = sanitizeBrandName(brandName)
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${clean ? `${clean} ` : ""}Questionnaire.docx`;
}

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function docParagraph({
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
    // English LTR document — every paragraph pinned to the left margin.
    alignment: AlignmentType.LEFT,
    spacing: spacingBefore ? { before: spacingBefore } : undefined,
    children: [
      new TextRun({
        text,
        font: FONT,
        size,
        bold,
        italics,
      }),
    ],
  });
}

export async function generateIntakeDocx(
  snapshot: IntakeSnapshotJson,
): Promise<Buffer> {
  const children: Paragraph[] = [
    docParagraph({
      text: `Brand Questionnaire — ${snapshot.brand.name}`,
      size: TITLE_SIZE,
      bold: true,
      heading: HeadingLevel.TITLE,
    }),
    docParagraph({
      text: `Submitted: ${snapshot.submittedAt}`,
      size: 22,
      italics: true,
    }),
    docParagraph({ text: "", size: BODY_SIZE }),
  ];

  for (const section of snapshot.sections) {
    children.push(
      docParagraph({
        text: section.title,
        size: SECTION_SIZE,
        bold: true,
        heading: HeadingLevel.HEADING_1,
        spacingBefore: 240,
      }),
    );

    for (const question of section.questions) {
      const answer = formatAnswerValue(question.answer.value);
      if (!answer) continue;

      // Each question is a Heading 2 so answers are separated and navigable.
      children.push(
        docParagraph({
          text: question.questionText,
          size: QUESTION_SIZE,
          bold: true,
          heading: HeadingLevel.HEADING_2,
          spacingBefore: 160,
        }),
      );
      children.push(docParagraph({ text: answer, size: BODY_SIZE }));
    }
  }

  // Left-align at the style level too, so the built-in Heading 1/2 and Normal
  // styles inherit it in every Word viewer (paragraph-level alignment already
  // covers each run, this is belt-and-suspenders for the named styles).
  const docStyle = {
    run: { font: FONT },
    paragraph: {
      alignment: AlignmentType.LEFT,
    },
  };

  const doc = new Document({
    styles: {
      default: {
        document: docStyle,
        heading1: docStyle,
        heading2: docStyle,
        title: docStyle,
      },
    },
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
