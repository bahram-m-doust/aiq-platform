"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addStakeholderAnnotationAction,
  resolveStakeholderAnnotationAction,
} from "@/features/stakeholder-interviews/actions";
import type { StakeholderAnnotation } from "@/features/stakeholder-interviews/types";
import { cn } from "@/lib/utils";

type Draft = { page: number; x: number; y: number } | null;

export function PdfAnnotator({
  signedUrl,
  reportId,
  initialAnnotations,
  editable,
  canResolve,
}: {
  signedUrl: string;
  reportId: string;
  initialAnnotations: StakeholderAnnotation[];
  editable: boolean;
  canResolve: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);

  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [annotations, setAnnotations] =
    useState<StakeholderAnnotation[]>(initialAnnotations);
  const [draft, setDraft] = useState<Draft>(null);
  const [draftBody, setDraftBody] = useState("");
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  // Load the PDF once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const res = await fetch(signedUrl);
        if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
        const data = await res.arrayBuffer();
        const doc = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;
        pdfRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Could not open the PDF.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  // Render the current page whenever it (or the container width) changes.
  const renderPage = useCallback(async () => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!doc || !canvas || !container) return;

    const pdfPage = await doc.getPage(page);
    const base = pdfPage.getViewport({ scale: 1 });
    const width = Math.min(container.clientWidth, 1100);
    const scale = width / base.width;
    const viewport = pdfPage.getViewport({ scale });
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    setSize({ width: viewport.width, height: viewport.height });
  }, [page]);

  useEffect(() => {
    void renderPage();
    const onResize = () => void renderPage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderPage, numPages]);

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!editable || !size) return;
    if (draft || openPin) {
      setDraft(null);
      setOpenPin(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setDraft({ page, x, y });
    setDraftBody("");
  }

  function saveDraft() {
    if (!draft || !draftBody.trim()) return;
    startSaving(async () => {
      const result = await addStakeholderAnnotationAction({
        reportId,
        page: draft.page,
        posX: draft.x,
        posY: draft.y,
        body: draftBody.trim(),
      });
      if (result.ok) {
        setAnnotations((current) => [...current, result.annotation]);
        setDraft(null);
        setDraftBody("");
      }
    });
  }

  function toggleResolve(annotation: StakeholderAnnotation) {
    if (!canResolve) return;
    const next = !annotation.resolved;
    setAnnotations((current) =>
      current.map((item) =>
        item.id === annotation.id ? { ...item, resolved: next } : item,
      ),
    );
    void resolveStakeholderAnnotationAction(annotation.id, next);
  }

  const pageAnnotations = annotations.filter((item) => item.page === page);

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-20 text-center text-sm text-muted-foreground">
            {numPages ? `Page ${page} / ${numPages}` : "Loading…"}
          </span>
          <Button
            disabled={numPages === 0 || page >= numPages}
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <ChevronRightIcon />
          </Button>
        </div>
        {editable ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquarePlusIcon className="size-3.5" />
            Click anywhere on the page to add a comment
          </span>
        ) : null}
      </div>

      <div className="w-full" ref={containerRef}>
        <div className="relative mx-auto w-fit rounded-lg border border-border bg-muted/30 shadow-xs">
          <canvas className="block rounded-lg" ref={canvasRef} />

          {size ? (
            <div
              aria-label="PDF annotation layer"
              className={cn(
                "absolute inset-0",
                editable ? "cursor-crosshair" : "cursor-default",
              )}
              onClick={handleOverlayClick}
              style={{ width: size.width, height: size.height }}
            >
            {pageAnnotations.map((annotation, index) => (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                key={annotation.id}
                style={{
                  left: annotation.posX * size.width,
                  top: annotation.posY * size.height,
                }}
              >
                <button
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold shadow-sm transition-transform hover:scale-110",
                    annotation.resolved
                      ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                      : "border-amber-300 bg-amber-100 text-amber-800",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpenPin((current) =>
                      current === annotation.id ? null : annotation.id,
                    );
                  }}
                  type="button"
                >
                  {index + 1}
                </button>

                {openPin === annotation.id ? (
                  <div
                    className="absolute left-1/2 top-7 z-10 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 text-left shadow-md"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="text-sm whitespace-pre-wrap text-foreground">
                      {annotation.body}
                    </p>
                    {canResolve ? (
                      <button
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleResolve(annotation)}
                        type="button"
                      >
                        <CheckIcon className="size-3" />
                        {annotation.resolved
                          ? "Mark unresolved"
                          : "Mark resolved"}
                      </button>
                    ) : annotation.resolved ? (
                      <p className="mt-2 text-xs text-emerald-600">Resolved</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}

            {draft && draft.page === page ? (
              <div
                className="absolute z-20 w-64 -translate-x-1/2 rounded-lg border border-border bg-popover p-3 shadow-md"
                onClick={(event) => event.stopPropagation()}
                style={{
                  left: draft.x * size.width,
                  top: draft.y * size.height + 10,
                }}
              >
                <Textarea
                  autoFocus
                  className="min-h-20 text-sm"
                  onChange={(event) => setDraftBody(event.target.value)}
                  placeholder="Add your comment…"
                  value={draftBody}
                />
                <div className="mt-2 flex justify-end gap-2">
                  <Button
                    onClick={() => setDraft(null)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={!draftBody.trim() || isSaving}
                    onClick={saveDraft}
                    size="sm"
                    type="button"
                  >
                    {isSaving ? (
                      <Loader2Icon className="animate-spin" />
                    ) : null}
                    Comment
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
