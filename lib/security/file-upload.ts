import "server-only";

import JSZip from "jszip";

export const maxDocumentUploadBytes = 10 * 1024 * 1024;
const maxDocxEntries = 256;
const maxDocxUncompressedBytes = 25 * 1024 * 1024;
const maxDocxEntryBytes = 10 * 1024 * 1024;
const maxPngDimension = 4096;
const maxPngPixels = 16_777_216;

export type SecureUploadKind =
  | "PDF"
  | "DOCX"
  | "TEXT"
  | "MARKDOWN"
  | "CSV"
  | "PNG"
  | "HTML";

type ValidationResult =
  | { ok: true; kind: SecureUploadKind; mimeType: string }
  | { ok: false; message: string };

const typeRules: Record<
  SecureUploadKind,
  { extensions: string[]; mimeTypes: string[] }
> = {
  PDF: { extensions: [".pdf"], mimeTypes: ["application/pdf"] },
  DOCX: {
    extensions: [".docx"],
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  TEXT: { extensions: [".txt"], mimeTypes: ["text/plain"] },
  MARKDOWN: {
    extensions: [".md", ".markdown"],
    mimeTypes: ["text/markdown", "text/plain"],
  },
  CSV: { extensions: [".csv"], mimeTypes: ["text/csv", "text/plain"] },
  PNG: { extensions: [".png"], mimeTypes: ["image/png"] },
  HTML: {
    extensions: [".html", ".htm"],
    mimeTypes: ["text/html"],
  },
};

function matchesDeclaredType(file: File, kind: SecureUploadKind): boolean {
  const name = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();
  const rule = typeRules[kind];
  return (
    rule.extensions.some((extension) => name.endsWith(extension)) &&
    rule.mimeTypes.includes(mimeType)
  );
}

function hasBytes(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function readUint32BigEndian(bytes: Uint8Array, offset: number): number {
  return new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  ).getUint32(offset, false);
}

function hasSafePngDimensions(prefix: Uint8Array): boolean {
  if (
    prefix.length < 24 ||
    !hasBytes(prefix.slice(12, 16), [0x49, 0x48, 0x44, 0x52])
  ) {
    return false;
  }

  const width = readUint32BigEndian(prefix, 16);
  const height = readUint32BigEndian(prefix, 20);
  return (
    width > 0 &&
    height > 0 &&
    width <= maxPngDimension &&
    height <= maxPngDimension &&
    width * height <= maxPngPixels
  );
}

function hasSafeDocxStructure(archive: JSZip): boolean {
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (entries.length === 0 || entries.length > maxDocxEntries) return false;
  if (
    !archive.file("[Content_Types].xml") ||
    !archive.file("word/document.xml")
  ) {
    return false;
  }

  let totalUncompressedBytes = 0;
  for (const entry of entries) {
    const normalizedName = entry.name.replaceAll("\\", "/").toLowerCase();
    if (
      normalizedName.endsWith("/vbaproject.bin") ||
      normalizedName.startsWith("word/activex/") ||
      normalizedName.startsWith("word/embeddings/")
    ) {
      return false;
    }

    const metadata = entry as unknown as {
      _data?: { uncompressedSize?: number };
    };
    const uncompressedSize = metadata._data?.uncompressedSize;
    if (
      typeof uncompressedSize !== "number" ||
      !Number.isSafeInteger(uncompressedSize) ||
      uncompressedSize < 0 ||
      uncompressedSize > maxDocxEntryBytes
    ) {
      return false;
    }
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > maxDocxUncompressedBytes) return false;
  }

  return true;
}

async function hasValidSignature(
  file: File,
  kind: SecureUploadKind,
): Promise<boolean> {
  const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());

  if (kind === "PDF") {
    if (!hasBytes(prefix, [0x25, 0x50, 0x44, 0x46, 0x2d])) return false;
    const tailStart = Math.max(0, file.size - 2048);
    const tail = new Uint8Array(await file.slice(tailStart).arrayBuffer());
    return new TextDecoder("latin1").decode(tail).includes("%%EOF");
  }

  if (kind === "PNG") {
    return (
      hasBytes(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
      hasSafePngDimensions(prefix)
    );
  }

  if (kind === "DOCX") {
    if (!hasBytes(prefix, [0x50, 0x4b, 0x03, 0x04])) return false;
    try {
      const archive = await JSZip.loadAsync(await file.arrayBuffer());
      return hasSafeDocxStructure(archive);
    } catch {
      return false;
    }
  }

  const text = new TextDecoder("utf-8", { fatal: true });
  let decoded: string;
  try {
    decoded = text.decode(prefix).replace(/^\uFEFF/, "").trimStart();
  } catch {
    return false;
  }

  if (kind === "HTML") {
    const lower = decoded.toLowerCase();
    return lower.startsWith("<!doctype html") || lower.startsWith("<html");
  }

  return !prefix.includes(0);
}

export async function validateSecureUpload({
  file,
  allowedKinds,
  maxBytes = maxDocumentUploadBytes,
}: {
  file: File;
  allowedKinds: readonly SecureUploadKind[];
  maxBytes?: number;
}): Promise<ValidationResult> {
  if (file.size <= 0) {
    return { ok: false, message: "Choose a non-empty file." };
  }
  if (file.size > maxBytes) {
    return {
      ok: false,
      message: `File must be ${Math.floor(maxBytes / 1024 / 1024)} MB or smaller.`,
    };
  }

  const kind = allowedKinds.find((candidate) =>
    matchesDeclaredType(file, candidate),
  );
  if (!kind || !(await hasValidSignature(file, kind))) {
    return {
      ok: false,
      message: "File extension, content type, or file signature is invalid.",
    };
  }

  return { ok: true, kind, mimeType: typeRules[kind].mimeTypes[0] };
}
