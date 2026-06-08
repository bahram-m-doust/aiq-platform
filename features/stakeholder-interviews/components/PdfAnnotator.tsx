"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  EllipsisIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  PencilIcon,
  ReplyIcon,
  Trash2Icon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  addStakeholderAnnotationAction,
  approveStakeholderReportAction,
  deleteStakeholderAnnotationAction,
  editStakeholderAnnotationAction,
  resolveStakeholderAnnotationAction,
} from "@/features/stakeholder-interviews/actions";
import { StakeholderHeader } from "@/features/stakeholder-interviews/components/StakeholderHeader";
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

function authorLabel(annotation: StakeholderAnnotation): string {
  return annotation.authorName ?? annotation.authorEmail ?? "Reviewer";
}

export function PdfAnnotator({
  signedUrl,
  reportId,
  currentUserId,
  initialAnnotations,
  editable,
  canResolve,
  canApprove,
  isApproved,
  status,
}: {
  signedUrl: string;
  reportId: string;
  currentUserId: string;
  initialAnnotations: StakeholderAnnotation[];
  editable: boolean;
  canResolve: boolean;
  canApprove: boolean;
  isApproved: boolean;
  status: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  // In-flight pdf.js render task. A new render must cancel and await the
  // previous one, otherwise pdf.js throws "Cannot use the same canvas during
  // multiple render() operations" (e.g. on resize or comment-panel toggles).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);
  // Per-page vertical content bounds (PDF user-space Y), used to trim the
  // empty top/bottom margins of low-content pages.
  const cropRef = useRef<Map<number, { minY: number; maxY: number }>>(
    new Map(),
  );

  // Actual PDF page numbers that have content (blank pages are skipped from
  // the dashboard view). `pageIndex` indexes into this list.
  const [contentPages, setContentPages] = useState<number[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  // Page indices the reviewer has actually landed on. Drives the "reviewed
  // N / total" hint and the soft warning when approving early.
  const [viewedPages, setViewedPages] = useState<Set<number>>(
    () => new Set([0]),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [annotations, setAnnotations] =
    useState<StakeholderAnnotation[]>(initialAnnotations);
  const [draft, setDraft] = useState<Draft>(null);
  const [draftBody, setDraftBody] = useState("");
  const [openPin, setOpenPin] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [isSaving, startSaving] = useTransition();
  const [isApproving, startApproving] = useTransition();

  // Comment thread editing state (sidebar).
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [isMutating, startMutating] = useTransition();

  // Root comments (pinned on the PDF) and their replies.
  const rootAnnotations = useMemo(
    () => annotations.filter((item) => !item.parentId),
    [annotations],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, StakeholderAnnotation[]>();
    for (const item of annotations) {
      if (!item.parentId) continue;
      const list = map.get(item.parentId) ?? [];
      list.push(item);
      map.set(item.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    }
    return map;
  }, [annotations]);

  function goToAnnotation(annotation: StakeholderAnnotation) {
    const idx = contentPages.indexOf(annotation.page);
    if (idx >= 0) goToPage(idx);
    setOpenPin(annotation.id);
  }

  // Navigate to a page and mark it reviewed (drives the "reviewed N / total"
  // hint and the soft warning when approving early).
  const goToPage = useCallback((index: number) => {
    setPageIndex(index);
    setViewedPages((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Ensure any previous render on this canvas has fully settled before
    // starting a new one.
    if (renderTaskRef.current) {
      const prev = renderTaskRef.current;
      prev.cancel();
      try {
        await prev.promise;
      } catch {
        // ignore cancellation
      }
      renderTaskRef.current = null;
    }

    canvas.width = Math.floor(cssWidth * ratio);
    canvas.height = Math.floor(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const task = pdfPage.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err) {
      if ((err as Error)?.name === "RenderingCancelledException") return;
      throw err;
    }
    if (renderTaskRef.current === task) renderTaskRef.current = null;
    setSize({ width: cssWidth, height: cssHeight });
  }, [currentPdfPage]);

  useEffect(() => {
    void renderPage();
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => void renderPage(), 150);
    };
    window.addEventListener("resize", onResize);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      // Cancel any in-flight render so it doesn't touch a stale canvas.
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
    // Re-render when the sidebar toggles (the PDF column changes width).
  }, [renderPage, contentPages.length, showComments]);

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
        setShowComments(true);
      }
    });
  }

  function saveReply(root: StakeholderAnnotation) {
    const body = replyBody.trim();
    if (!body) return;
    startMutating(async () => {
      const result = await addStakeholderAnnotationAction({
        reportId,
        page: root.page,
        posX: root.posX,
        posY: root.posY,
        body,
        parentId: root.id,
      });
      if (result.ok) {
        setAnnotations((current) => [...current, result.annotation]);
        setReplyTo(null);
        setReplyBody("");
      }
    });
  }

  function saveEdit(annotation: StakeholderAnnotation) {
    const body = editBody.trim();
    if (!body) return;
    startMutating(async () => {
      const result = await editStakeholderAnnotationAction(annotation.id, body);
      if (result.ok) {
        setAnnotations((current) =>
          current.map((item) =>
            item.id === annotation.id ? { ...item, body } : item,
          ),
        );
        setEditingId(null);
        setEditBody("");
      }
    });
  }

  function deleteAnnotation(annotation: StakeholderAnnotation) {
    startMutating(async () => {
      const result = await deleteStakeholderAnnotationAction(annotation.id);
      if (result.ok) {
        setAnnotations((current) =>
          current.filter(
            (item) =>
              item.id !== annotation.id && item.parentId !== annotation.id,
          ),
        );
        if (openPin === annotation.id) setOpenPin(null);
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

  // Only root comments are pinned on the page; replies live in the sidebar.
  const pagePins = rootAnnotations.filter(
    (item) => item.page === currentPdfPage,
  );
  const totalPages = contentPages.length;
  const reviewedCount = Math.min(viewedPages.size, totalPages || 1);
  const allReviewed = totalPages > 0 && reviewedCount >= totalPages;

  function startEditing(annotation: StakeholderAnnotation) {
    setEditingId(annotation.id);
    setEditBody(annotation.body);
    setReplyTo(null);
  }

  const sortedRoots = [...rootAnnotations].sort(
    (a, b) =>
      a.page - b.page || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
  );

  return (
    <div className="px-2 pt-[15px]">
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left column — header, hint, PDF, approve. Centered in the space
            that remains beside the right-anchored comments rail. */}
        <div className="flex min-w-0 flex-1 lg:justify-center">
          <div className="flex w-full flex-col gap-4 lg:max-w-[756px]">
          <StakeholderHeader status={status} />

          {editable ? (
            <div className="flex items-center gap-[9px]">
              <MessageSquarePlusIcon className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-[12px] font-light text-muted-foreground">
                Click anywhere on the page to add a comment.
              </span>
            </div>
          ) : null}

          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                aria-label="Previous page"
                disabled={pageIndex <= 0}
                onClick={() => goToPage(Math.max(0, pageIndex - 1))}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronLeftIcon />
              </Button>
              <span className="min-w-[84px] text-center text-sm text-muted-foreground tabular-nums">
                {pageIndex + 1} / {totalPages}
              </span>
              <Button
                aria-label="Next page"
                disabled={pageIndex >= totalPages - 1}
                onClick={() => goToPage(Math.min(totalPages - 1, pageIndex + 1))}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}

          {loadError ? (
            <div className="rounded-[10px] border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {loadError}
            </div>
          ) : (
            <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card shadow-xs">
              <div className="p-3">
                <div className="w-full" ref={containerRef}>
                  <div className="relative mx-auto w-fit">
                <canvas className="block rounded-[6px]" ref={canvasRef} />

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
                    {pagePins.map((annotation, index) => (
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
                            setShowComments(true);
                          }}
                          type="button"
                        >
                          {index + 1}
                        </button>

                        {openPin === annotation.id ? (
                          <div
                            className="absolute left-1/2 top-7 z-10 w-64 -translate-x-1/2 rounded-[10px] border border-border bg-popover p-3 text-left shadow-md"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <p className="whitespace-pre-wrap text-sm text-foreground">
                              {annotation.body}
                            </p>
                            {annotation.resolved ? (
                              <p className="mt-2 text-xs text-[#008a2e]">
                                Solved
                              </p>
                            ) : canResolve ? (
                              <button
                                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => toggleResolve(annotation)}
                                type="button"
                              >
                                <CheckIcon className="size-3" />
                                Mark solved
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {draft && draft.page === currentPdfPage ? (
                      <div
                        className="absolute z-20 w-64 -translate-x-1/2 rounded-[10px] border border-border bg-popover p-3 shadow-md"
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
                            variant="outline"
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

                  {!size ? (
                    <div className="flex h-[479px] w-full items-center justify-center text-sm text-muted-foreground">
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      Loading report…
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {isApproved ? (
            <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-[#157a52]">
                <CheckCircleIcon className="size-4" />
                Stakeholder interviews approved.
              </span>
            </div>
          ) : canApprove ? (
            <div className="flex flex-col items-center gap-2 pt-2">
              {totalPages > 1 ? (
                <span
                  className={cn(
                    "text-[12px]",
                    allReviewed
                      ? "font-medium text-[#157a52]"
                      : "text-muted-foreground",
                  )}
                >
                  {allReviewed
                    ? "All pages reviewed."
                    : `Reviewed ${reviewedCount} / ${totalPages} pages`}
                </span>
              ) : null}
              <ConfirmDialog
                confirmLabel="Approve"
                description="Approving unlocks Futures Research and locks this report from further changes."
                errorMessage={null}
                isPending={isApproving}
                onConfirm={approve}
                onOpenChange={setConfirmOpen}
                open={confirmOpen}
                pendingLabel="Approving…"
                title="Approve this report?"
                trigger={
                  <Button
                    className="min-w-[166px]"
                    disabled={isApproving}
                    size="lg"
                    type="button"
                  >
                    {isApproving ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : null}
                    Approve
                  </Button>
                }
                variant="default"
              >
                {!allReviewed && totalPages > 1 ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      You haven&apos;t viewed all pages yet ({reviewedCount} /{" "}
                      {totalPages}). You can still approve, but consider
                      reviewing the rest first.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </ConfirmDialog>
            </div>
          ) : null}
          </div>
        </div>

        {/* Right column — comments */}
        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[244px]">
          <div className="flex items-center justify-end gap-3">
            <Button asChild size="icon" title="Download PDF" variant="secondary">
              <a download href={signedUrl} rel="noreferrer">
                <DownloadIcon />
              </a>
            </Button>
            <Button
              aria-pressed={showComments}
              className="flex-1 justify-center lg:w-[184px] lg:flex-none"
              onClick={() => setShowComments((value) => !value)}
              type="button"
              variant="secondary"
            >
              Comments
              <ChevronsUpDownIcon />
            </Button>
          </div>

          {showComments ? (
            sortedRoots.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
                No comments yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {sortedRoots.map((root) => {
                  const displayPage =
                    contentPages.indexOf(root.page) + 1 || root.page;
                  const replies = repliesByParent.get(root.id) ?? [];
                  const isActive = openPin === root.id;
                  return (
                    <li key={root.id}>
                      <div
                        className={cn(
                          "rounded-[10px] border bg-card p-2.5 shadow-xs transition-colors",
                          isActive
                            ? "border-foreground/20"
                            : "border-border",
                        )}
                      >
                        <CommentBlock
                          annotation={root}
                          canResolve={canResolve}
                          currentUserId={currentUserId}
                          editBody={editBody}
                          editable={editable}
                          editingId={editingId}
                          isMutating={isMutating}
                          onCancelEdit={() => {
                            setEditingId(null);
                            setEditBody("");
                          }}
                          onDelete={() => deleteAnnotation(root)}
                          onEditBodyChange={setEditBody}
                          onReply={() => {
                            setReplyTo(root.id);
                            setReplyBody("");
                            setEditingId(null);
                          }}
                          onSaveEdit={() => saveEdit(root)}
                          onSelect={() => goToAnnotation(root)}
                          onStartEdit={() => startEditing(root)}
                          onToggleResolve={() => toggleResolve(root)}
                          pageLabel={`Page ${displayPage}`}
                        />

                        {replies.length > 0 ? (
                          <ul className="mt-3 flex flex-col gap-3 border-l border-border pl-3">
                            {replies.map((reply) => (
                              <li key={reply.id}>
                                <CommentBlock
                                  annotation={reply}
                                  canResolve={false}
                                  currentUserId={currentUserId}
                                  editBody={editBody}
                                  editable={editable}
                                  editingId={editingId}
                                  isMutating={isMutating}
                                  isReply
                                  onCancelEdit={() => {
                                    setEditingId(null);
                                    setEditBody("");
                                  }}
                                  onDelete={() => deleteAnnotation(reply)}
                                  onEditBodyChange={setEditBody}
                                  onSaveEdit={() => saveEdit(reply)}
                                  onStartEdit={() => startEditing(reply)}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        {editable && replyTo === root.id ? (
                          <div className="mt-3">
                            <Textarea
                              autoFocus
                              className="min-h-16 text-sm"
                              onChange={(event) =>
                                setReplyBody(event.target.value)
                              }
                              placeholder="Write a reply…"
                              value={replyBody}
                            />
                            <div className="mt-2 flex justify-end gap-2">
                              <Button
                                onClick={() => {
                                  setReplyTo(null);
                                  setReplyBody("");
                                }}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                Cancel
                              </Button>
                              <Button
                                disabled={!replyBody.trim() || isMutating}
                                onClick={() => saveReply(root)}
                                size="sm"
                                type="button"
                                variant="outline"
                              >
                                {isMutating ? (
                                  <Loader2Icon className="animate-spin" />
                                ) : null}
                                Reply
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CommentBlock({
  annotation,
  currentUserId,
  editable,
  canResolve,
  isReply = false,
  editingId,
  editBody,
  isMutating,
  pageLabel,
  onSelect,
  onReply,
  onStartEdit,
  onEditBodyChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onToggleResolve,
}: {
  annotation: StakeholderAnnotation;
  currentUserId: string;
  editable: boolean;
  canResolve: boolean;
  isReply?: boolean;
  editingId: string | null;
  editBody: string;
  isMutating: boolean;
  pageLabel?: string;
  onSelect?: () => void;
  onReply?: () => void;
  onStartEdit: () => void;
  onEditBodyChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onToggleResolve?: () => void;
}) {
  const isOwn = annotation.authorId === currentUserId;
  const isEditing = editingId === annotation.id;

  const canReply = Boolean(editable && onReply);
  const canEdit = editable && isOwn;
  const showMenu = !isEditing && (canReply || canEdit);

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-medium text-foreground",
              isReply ? "text-[12px]" : "text-[12px]",
            )}
          >
            {authorLabel(annotation)}
          </p>
          <p className="mt-1 text-[12px] font-light text-muted-foreground">
            {formatCommentDate(annotation.createdAt)}
          </p>
        </div>

        {showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Comment actions"
                className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                type="button"
              >
                <EllipsisIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              {canReply ? (
                <DropdownMenuItem onSelect={() => onReply?.()}>
                  <ReplyIcon />
                  Reply
                </DropdownMenuItem>
              ) : null}
              {canResolve && onToggleResolve && !annotation.resolved ? (
                <DropdownMenuItem onSelect={() => onToggleResolve()}>
                  <CheckIcon />
                  Mark solved
                </DropdownMenuItem>
              ) : null}
              {canEdit ? (
                <DropdownMenuItem onSelect={() => onStartEdit()}>
                  <PencilIcon />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {canEdit ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={isMutating}
                    onSelect={() => onDelete()}
                  >
                    <Trash2Icon />
                    Delete
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {isEditing ? (
        <div className="mt-2">
          <Textarea
            autoFocus
            className="min-h-16 text-sm"
            onChange={(event) => onEditBodyChange(event.target.value)}
            value={editBody}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button
              onClick={onCancelEdit}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              disabled={!editBody.trim() || isMutating}
              onClick={onSaveEdit}
              size="sm"
              type="button"
              variant="outline"
            >
              {isMutating ? <Loader2Icon className="animate-spin" /> : null}
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          {onSelect ? (
            <button
              className="mt-2 block w-full text-left"
              onClick={onSelect}
              type="button"
            >
              <p className="whitespace-pre-wrap text-[12px] text-muted-foreground">
                {annotation.body}
              </p>
            </button>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-[12px] text-muted-foreground">
              {annotation.body}
            </p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
            {pageLabel ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {pageLabel}
              </span>
            ) : null}
            {annotation.resolved ? (
              <span className="font-medium text-[#008a2e]">Solved</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
