import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  maxDocumentUploadBytes,
  validateSecureUpload,
} from "@/lib/security/file-upload";

describe("secure file upload validation", () => {
  it("requires matching PDF metadata and signature", async () => {
    const valid = new File(["%PDF-1.7\n%%EOF"], "report.pdf", {
      type: "application/pdf",
    });
    const disguised = new File(["plain text"], "report.pdf", {
      type: "application/pdf",
    });

    await expect(
      validateSecureUpload({ file: valid, allowedKinds: ["PDF"] }),
    ).resolves.toMatchObject({ ok: true, mimeType: "application/pdf" });
    await expect(
      validateSecureUpload({ file: disguised, allowedKinds: ["PDF"] }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("requires a real DOCX document entry", async () => {
    const archive = new JSZip();
    archive.file("[Content_Types].xml", "<Types />");
    archive.file("word/document.xml", "<w:document />");
    const bytes = await archive.generateAsync({ type: "uint8array" });
    const file = new File([new Uint8Array(bytes).buffer], "strategy.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    await expect(
      validateSecureUpload({ file, allowedKinds: ["DOCX"] }),
    ).resolves.toMatchObject({ ok: true, kind: "DOCX" });
  });

  it("rejects DOCX archives with embedded active content or too many entries", async () => {
    const embeddedArchive = new JSZip();
    embeddedArchive.file("[Content_Types].xml", "<Types />");
    embeddedArchive.file("word/document.xml", "<w:document />");
    embeddedArchive.file("word/embeddings/payload.bin", "payload");
    const embeddedBytes = await embeddedArchive.generateAsync({
      type: "uint8array",
    });
    const embeddedFile = new File(
      [new Uint8Array(embeddedBytes).buffer],
      "embedded.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );

    const crowdedArchive = new JSZip();
    crowdedArchive.file("[Content_Types].xml", "<Types />");
    crowdedArchive.file("word/document.xml", "<w:document />");
    for (let index = 0; index < 260; index += 1) {
      crowdedArchive.file(`word/media/${index}.txt`, "");
    }
    const crowdedBytes = await crowdedArchive.generateAsync({
      type: "uint8array",
    });
    const crowdedFile = new File(
      [new Uint8Array(crowdedBytes).buffer],
      "crowded.docx",
      {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
    );

    await expect(
      validateSecureUpload({
        file: embeddedFile,
        allowedKinds: ["DOCX"],
      }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      validateSecureUpload({
        file: crowdedFile,
        allowedKinds: ["DOCX"],
      }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects PNG files with unsafe dimensions", async () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(bytes.buffer).setUint32(16, 100_000, false);
    new DataView(bytes.buffer).setUint32(20, 100_000, false);
    const file = new File([bytes.buffer], "oversized.png", {
      type: "image/png",
    });

    await expect(
      validateSecureUpload({ file, allowedKinds: ["PNG"] }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("rejects oversized and executable document uploads", async () => {
    const oversized = new File(
      [new Uint8Array(maxDocumentUploadBytes + 1)],
      "large.txt",
      { type: "text/plain" },
    );
    const html = new File(["<!doctype html>"], "payload.html", {
      type: "text/html",
    });

    await expect(
      validateSecureUpload({ file: oversized, allowedKinds: ["TEXT"] }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      validateSecureUpload({
        file: html,
        allowedKinds: ["PDF", "DOCX", "TEXT"],
      }),
    ).resolves.toMatchObject({ ok: false });
  });
});
