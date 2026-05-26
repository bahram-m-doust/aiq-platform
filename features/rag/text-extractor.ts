import "server-only";

import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

import { DomainError } from "@/lib/errors";

const docxMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const pdfMimeTypes = new Set(["application/pdf"]);

const textMimeTypes = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
]);

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:p[^>]*\/>/g, "\n")
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<\/w:p>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const docXml = zip.file("word/document.xml");
  if (!docXml) {
    throw new DomainError("text_extractor", "DOCX file has no document.xml.");
  }
  const xml = await docXml.async("string");
  return stripXmlTags(xml);
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text.trim();
}

function extractFromText(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string | null,
): Promise<string> {
  const mime = mimeType ?? "";

  if (docxMimeTypes.has(mime)) {
    return extractFromDocx(buffer);
  }

  if (pdfMimeTypes.has(mime)) {
    return extractFromPdf(buffer);
  }

  if (textMimeTypes.has(mime)) {
    return extractFromText(buffer);
  }

  throw new DomainError(
    "text_extractor",
    `Unsupported file type for text extraction: ${mime || "unknown"}`,
  );
}
