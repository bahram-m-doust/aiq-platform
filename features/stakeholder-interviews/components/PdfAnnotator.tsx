"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckIcon,
  Loader2Icon,
  MessagesSquareIcon,
  MessageSquarePlusIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  addStakeholderAnnotationAction,
  approveStakeholderReportAction,
  resolveStakeholderAnnotationAction,
} from "@/features/stakeholder-interviews/actions";
import type { StakeholderAnnotation } from "@/features/stakeholder-interviews/types";
import { cn } from "@/lib/utils";

type Draft = { page: number; x: number; y: number } | null;

function formatCommentDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PdfAnnotator({
  signedUrl,
  reportId,
  initialAnnotations,
  editable,
  canResolve,
  canApprove,
  isApproved,
}: {
  signedUrl: string;
  reportId: string;
  initialAnnotations: StakeholderAnnotation[];
  editable: boolean;
  canResolve: boolean;
  canApprove: boolean;
  isApproved: boolean;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  // Per-page vertical content bounds (PDF user-space Y), used to trim the
  // empty top/bottom margins of low-content pages.
  const cropRef = useRef<Map<number, { minY: number; maxY: number }>>(
    new Map(),
  );

  // Actual PDF page numbers that have content (blank pages are skipped from
  // the dashboard view). `pageIndex` indexes into this list.
  const [contentPages, setContentPages] = useState<number[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [annotations, setAnnotations] =
    useState<StakeholderAnnotation[]>(initialAnnotations);
  const [draft, setDraft] = useState<Draft>(null);
  const [draftBody, setDraftBody] = useState("");
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isApproving, startApproving] = useTransition();

  function goToAnnotation(annotation: StakeholderAnnotation) {
    const idx = contentPages.indexOf(annotation.page);
    if (idx >= 0) setPageIndex(idx);
    setOpenPin(annotation.id);
  }

  function approve() {
    startApproving(async () => {
      const result = await approveStakeholderReportAction();
      if (result.ok) router.refresh();
    });
  }

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

        // Keep only pages that actually have content (text or images), so the
        // dashboard view drops blank pages / empty filler pages.
        const ops = pdfjs.OPS;
        const imageOps = new Set([
          ops.paintImageXObject,
          ops.paintInlineImageXObject,
          ops.paintImageMaskXObject,
        ]);
        const withContent: number[] = [];
        for (let i = 1; i <= doc.numPages; i += 1) {
          const pdfPage = await doc.getPage(i);
          const textContent = await pdfPage.getTextContent();
          const hasText = textContent.items.some(
            (item) => "str" in item && item.str.trim().length > 0,
          );
          let hasImage = false;
          if (!hasText) {
            const opList = await pdfPage.getOperatorList();
            hasImage = opList.fnArray.some((fn: number) => imageOps.has(fn));
          }
          if (hasText || hasImage) withContent.push(i);

          if (hasText) {
            let minY = Infinity;
            let maxY = -Infinity;
            for (const item of textContent.items) {
              if (!("str" in item) || !item.str.trim()) continue;
              const y = item.transform[5];
              const h = item.height || 0;
              if (y - h * 0.3 < minY) minY = y - h * 0.3;
              if (y + h > maxY) maxY = y + h;
            }
            if (minY < maxY) cropRef.current.set(i, { minY, maxY });
          }
          if (cancelled) return;
        }
        setContentPages(withContent.length > 0 ? withContent : [1]);
        setPageIndex(0);
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

  const currentPdfPage = contentPages[pageIndex] ?? 1;

  // Render the current page whenever it (or the container width) changes.
  const renderPage = useCallback(async () => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!doc || !canvas || !container) return;

    const pdfPage = await doc.getPage(currentPdfPage);
    const base = pdfPage.getViewport({ scale: 1 });
    // Cap the render width so the text reads at a comfortable, smaller size.
    const width = Math.min(container.clientWidth, 720);
    const scale = width / base.width;
    const ratio = window.devicePixelRatio || 1;

    // Trim empty top/bottom margins on low-content pages.
    const crop = cropRef.current.get(currentPdfPage);
    const pad = 24;
    let viewport: { width: number; height: number };
    let cssWidth = width;
    let cssHeight: number;
    if (crop) {
      const minY = Math.max(0, crop.minY - pad);
      const maxY = Math.min(base.height, crop.maxY + pad);
      const topCrop = (base.height - maxY) * scale;
      cssHeight = (maxY - minY) * scale;
      viewport = pdfPage.getViewport({ scale, offsetY: -topCrop });
    } else {
      const full = pdfPage.getViewport({ scale });
      viewport = full;
      cssWidth = full.width;
      cssHeight = full.height;
    }

    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    await pdfPage.render({ canvasContext: ctx, viewport }).promise;
    setSize({ width: cssWidth, height: cssHeight });
  }, [currentPdfPage]);

  useEffect(() => {
    void renderPage();
    const onResize = () => void renderPage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [renderPage, contentPages.length]);

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
    setDraft({ page: currentPdfPage, x, y });
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

  const pageAnnotations = annotations.filter(
    (item) => item.page === currentPdfPage,
  );
  const totalPages = contentPages.length;

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
        <Button
          onClick={() => setShowComments((value) => !value)}
          size="sm"
          type="button"
          variant="outline"
        >
          <MessagesSquareIcon />
          Show all comments ({annotations.length})
        </Button>
        {editable ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquarePlusIcon className="size-3.5" />
            Click anywhere on the page to add a comment
          </span>
        ) : null}
      </div>

      {showComments ? (
        <div className="rounded-lg border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-sm font-medium">
              Comments ({annotations.length})
            </span>
            <Button
              aria-label="Close comments"
              onClick={() => setShowComments(false)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <XIcon />
            </Button>
          </div>
          {annotations.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No comments yet.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto">
              {[...annotations]
                .sort(
                  (a, b) =>
                    a.page - b.page ||
                    (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
                )
                .map((annotation) => {
                  const displayPage =
                    contentPages.indexOf(annotation.page) + 1 ||
                    annotation.page;
                  return (
                    <li key={annotation.id}>
                      <button
                        className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                        onClick={() => goToAnnotation(annotation)}
                        type="button"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {annotation.authorName ??
                              annotation.authorEmail ??
                              "Reviewer"}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatCommentDate(annotation.createdAt)}
                          </span>
                        </div>
                        <p className="line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">
                          {annotation.body}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded bg-muted px-1.5 py-0.5">
                            Page {displayPage}
                          </span>
                          {annotation.resolved ? (
                            <span className="text-emerald-600">Resolved</span>
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      ) : null}

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

            {draft && draft.page === currentPdfPage ? (
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

      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={pageIndex <= 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeftIcon />
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">
          {totalPages ? `Page ${pageIndex + 1} / ${totalPages}` : "Loading…"}
        </span>
        {pageIndex < totalPages - 1 ? (
          <Button
            onClick={() =>
              setPageIndex((i) => Math.min(totalPages - 1, i + 1))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            Next
            <ChevronRightIcon />
          </Button>
        ) : canApprove && !isApproved ? (
          <Button
            disabled={isApproving}
            onClick={approve}
            size="sm"
            type="button"
          >
            {isApproving ? <Loader2Icon className="animate-spin" /> : null}
            Approve &amp; continue
          </Button>
        ) : (
          <span aria-hidden className="w-[92px]" />
        )}
      </div>
    </div>
  );
}
