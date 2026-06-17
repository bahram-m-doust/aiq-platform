import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  isFuturesResearchPdf,
  isFuturesResearchStoryline,
  maxFuturesResearchStorylineBytes,
} from "@/features/futures-research/schema";
import { validateSecureUpload } from "@/lib/security/file-upload";
import {
  storylineContentSecurityPolicy,
  storylineResponseHeaders,
} from "@/features/futures-research/storyline-security";

describe("Futures Research upload security", () => {
  it("requires matching file names, MIME types, sizes, and signatures", async () => {
    const pdf = new File(["%PDF-1.7\n%%EOF"], "report.pdf", {
      type: "application/pdf",
    });
    const html = new File(["<!doctype html><html></html>"], "story.html", {
      type: "text/html",
    });
    const disguisedHtml = new File(["not html"], "story.html", {
      type: "text/html",
    });

    expect(isFuturesResearchPdf(pdf)).toBe(true);
    await expect(
      validateSecureUpload({ file: pdf, allowedKinds: ["PDF"] }),
    ).resolves.toMatchObject({ ok: true, kind: "PDF" });
    expect(isFuturesResearchStoryline(html)).toBe(true);
    await expect(
      validateSecureUpload({ file: html, allowedKinds: ["HTML"] }),
    ).resolves.toMatchObject({ ok: true, kind: "HTML" });
    await expect(
      validateSecureUpload({
        file: disguisedHtml,
        allowedKinds: ["HTML"],
      }),
    ).resolves.toMatchObject({ ok: false });
    expect(
      isFuturesResearchStoryline(
        new File([new Uint8Array(maxFuturesResearchStorylineBytes + 1)], "story.html", {
          type: "text/html",
        }),
      ),
    ).toBe(false);
  });

  it("isolates interactive HTML from the application origin", () => {
    expect(storylineContentSecurityPolicy).toContain("sandbox allow-scripts");
    expect(storylineContentSecurityPolicy).toContain("connect-src 'none'");
    expect(storylineContentSecurityPolicy).toContain("form-action 'none'");
    expect(storylineResponseHeaders["X-Content-Type-Options"]).toBe("nosniff");

    // The interactive storyline is never embedded in an app page; it is served
    // only through the download route, which applies the sandboxing response
    // headers so its scripts cannot reach the application origin.
    const route = fs.readFileSync(
      path.join(
        process.cwd(),
        "app",
        "api",
        "futures-research",
        "storyline",
        "[reportId]",
        "route.ts",
      ),
      "utf8",
    );
    expect(route).toContain("headers: storylineResponseHeaders");
  });
});
