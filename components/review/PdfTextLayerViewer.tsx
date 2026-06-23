"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Renders a PDF with pdf.js so each page has a *selectable* text layer, then
// tags every page's text layer with `data-block-content="pdf-page-N"`. That is
// the exact contract the surrounding ReviewableDocumentViewer relies on to
// capture selections, paint highlights, and anchor comments — so the same
// Google-Docs-style commenting that works on extracted markdown works directly
// on the rendered PDF, no iframe required.
//
// The worker is served from /public (kept in sync with the installed
// pdfjs-dist) so its version always matches the main-thread API.
const WORKER_SRC = "/pdf.worker.min.mjs";

// Page numbers are stable anchors; build/read them in one place.
export function pdfPageAnchorId(pageNumber: number): string {
  return `pdf-page-${pageNumber}`;
}

// The pdf.js text-layer CSS, scoped under our wrapper. Injected at runtime
// (not via globals.css) so it ships with the component that needs it. The
// transparent, absolutely-positioned spans sit over the rendered canvas, so a
// browser selection — and the CSS Custom Highlight API the parent paints with —
// land exactly over the visible glyphs.
const TEXT_LAYER_STYLES = `
.pdf-doc{display:flex;flex-direction:column;align-items:center;gap:16px;}
.pdf-page{position:relative;direction:ltr;box-shadow:0 1px 3px rgba(0,0,0,0.12);background:#fff;}
.pdf-page canvas{display:block;}
.pdf-page .textLayer{position:absolute;inset:0;overflow:clip;opacity:1;line-height:1;text-align:initial;transform-origin:0 0;forced-color-adjust:none;z-index:1;}
.pdf-page .textLayer :is(span,br){color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0% 0%;}
.pdf-page .textLayer span.markedContent{top:0;height:0;}
.pdf-page .textLayer .endOfContent{display:block;position:absolute;inset:100% 0 0;z-index:0;cursor:default;user-select:none;}
.pdf-page .textLayer.selecting .endOfContent{top:0;}
.pdf-page .textLayer ::selection{background:transparent;}
`;

type RenderState = "loading" | "ready" | "error";

export function PdfTextLayerViewer({
  fileUrl,
  onRendered,
}: {
  fileUrl: string;
  // Fired once every page's text layer is in the DOM, so the parent can repaint
  // stored highlights against the freshly-rendered pages.
  onRendered?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<RenderState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const styles = window.getComputedStyle(host);
      const paddingX =
        Number.parseFloat(styles.paddingLeft || "0") +
        Number.parseFloat(styles.paddingRight || "0");
      const width = Math.max(320, Math.floor((host.clientWidth || 800) - paddingX));
      setAvailableWidth((prev) => (prev === width ? prev : width));
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let doc: any = null;

    async function run() {
      const host = hostRef.current;
      if (!host) return;
      setState("loading");
      setError(null);
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;

        const task = pdfjs.getDocument({ url: fileUrl });
        doc = await task.promise;
        if (cancelled) return;

        // Fit the page to the available width (retina-crisp via devicePixelRatio),
        // measured once at render time.
        const available = availableWidth || 800;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const root = document.createElement("div");
        root.className = "pdf-doc";

        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await doc.getPage(pageNumber);
          if (cancelled) return;

          const unscaled = page.getViewport({ scale: 1 });
          const scale = available / unscaled.width;
          const viewport = page.getViewport({ scale });

          const pageEl = document.createElement("div");
          pageEl.className = "pdf-page";
          pageEl.style.width = `${Math.floor(viewport.width)}px`;
          pageEl.style.height = `${Math.floor(viewport.height)}px`;
          // pdf.js text-layer spans position themselves off this variable.
          pageEl.style.setProperty("--scale-factor", `${scale}`);

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * dpr);
          canvas.height = Math.floor(viewport.height * dpr);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas is unavailable.");

          const textLayerEl = document.createElement("div");
          textLayerEl.className = "textLayer";
          // The contract the parent reads: a per-page block anchor + label.
          textLayerEl.dataset.blockContent = pdfPageAnchorId(pageNumber);
          textLayerEl.dataset.blockLabel = `Page ${pageNumber}`;

          pageEl.appendChild(canvas);
          pageEl.appendChild(textLayerEl);
          root.appendChild(pageEl);

          await page.render({
            canvasContext: ctx,
            viewport,
            transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
          }).promise;
          if (cancelled) return;

          const textLayer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textLayerEl,
            viewport,
          });
          await textLayer.render();
          if (cancelled) return;
        }

        if (cancelled) return;
        host.replaceChildren(root);
        setState("ready");
        onRendered?.();
      } catch (caught) {
        if (cancelled) return;
        setState("error");
        setError(
          caught instanceof Error ? caught.message : "Could not load the PDF.",
        );
      }
    }

    void run();
    return () => {
      cancelled = true;
      try {
        doc?.destroy?.();
      } catch {
        // Ignore teardown races.
      }
    };
  }, [availableWidth, fileUrl, onRendered]);

  return (
    <div className="relative">
      <style dangerouslySetInnerHTML={{ __html: TEXT_LAYER_STYLES }} />
      {state === "loading" ? (
        <div className="flex h-[479px] items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Loading document…
        </div>
      ) : null}
      {state === "error" ? (
        <div className="flex h-[479px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
          <p>The document could not be displayed here.</p>
          {error ? <p className="text-[12px]">{error}</p> : null}
          <a
            className="text-primary underline"
            href={fileUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open the file in a new tab
          </a>
        </div>
      ) : null}
      <div ref={hostRef} />
    </div>
  );
}
