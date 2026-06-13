"use client";

import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CheckCircle2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  EllipsisIcon,
  Loader2Icon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  ReplyIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import type {
  AddReviewCommentInput,
  AddReviewCommentResult,
  CommentHighlight,
  ReviewComment,
  ReviewCommentMutationResult,
  ReviewSubjectType,
} from "@/features/review-comments/types";
import {
  createRangeFromOffsets,
  findQuoteOffsets,
  getSelectionOffsets,
  offsetUnderPoint,
  supportsHighlightApi,
} from "@/lib/highlight/text-range";
import type { MarkdownBlock } from "@/lib/markdown/blocks";
import { cn } from "@/lib/utils";

const GENERAL_KEY = "__general__";

// "Active section" comment highlight. Amber deliberately sits apart from the
// cyan brand so a selected/commented section reads as a comment marker (the
// Google-Docs convention), not as a primary action.
const ACTIVE_SECTION_CLASS = "bg-amber-50/60 ring-1 ring-amber-200";
const ACTIVE_MARKER_CLASS = "border-amber-300 text-amber-700";

// The "Solved" status colour from the Figma design (sonner success green).
const SOLVED_COLOR = "text-[#008a2e]";

export type ReviewCommentActions = {
  add: (input: AddReviewCommentInput) => Promise<AddReviewCommentResult>;
  edit: (args: {
    subjectType: string;
    subjectId: string;
    commentId: string;
    body: string;
    brandId?: string;
  }) => Promise<ReviewCommentMutationResult>;
  remove: (args: {
    subjectType: string;
    subjectId: string;
    commentId: string;
    brandId?: string;
  }) => Promise<ReviewCommentMutationResult>;
  resolve: (args: {
    subjectType: string;
    subjectId: string;
    commentId: string;
    resolved: boolean;
    brandId?: string;
  }) => Promise<ReviewCommentMutationResult>;
};

export type ReviewDecision = {
  canDecide: boolean;
  isApproved: boolean;
  onApprove: () => Promise<{ ok: boolean; message?: string }>;
  onRequestChanges: () => Promise<{ ok: boolean; message?: string }>;
};

type Target = { anchorId: string | null; label: string | null };

// A live text selection inside a block, captured on mouse-up and offered as the
// anchor for a new highlight comment. `rect` positions the floating composer.
type PendingSelection = {
  anchorId: string;
  label: string | null;
  highlight: CommentHighlight;
  rect: { top: number; left: number; width: number };
};

const HIGHLIGHT_NAME = "review-comment";
const HIGHLIGHT_ACTIVE_NAME = "review-comment-active";

// Injected at runtime rather than via globals.css: the build's CSS parser
// rejects the `::highlight()` pseudo-element and drops the rule, but the browser
// (which supports the Custom Highlight API) parses it fine from a live <style>.
// Muted amber matches the comment-marker convention; the active range paints
// stronger and on top.
const HIGHLIGHT_STYLES = `
::highlight(${HIGHLIGHT_NAME}){background-color:rgba(245,158,11,0.20);}
::highlight(${HIGHLIGHT_ACTIVE_NAME}){background-color:rgba(245,158,11,0.45);border-radius:2px;}
`;

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // Matches the Figma comment card, e.g. "Jun 6, 2026, 02:31 PM".
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function authorLabel(comment: ReviewComment): string {
  return comment.authorName ?? comment.authorEmail ?? "Reviewer";
}

function anchorKey(anchorId: string | null): string {
  return anchorId ?? GENERAL_KEY;
}

export function ReviewableDocumentViewer({
  subjectType,
  subjectId,
  title,
  description,
  statusBadge,
  eyebrow,
  blocks,
  initialComments,
  currentUserId,
  canComment,
  downloadUrl,
  downloadName,
  fileUrl,
  contextBrandId,
  decision,
  actions,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  title: string;
  description?: string | null;
  statusBadge?: ReactNode;
  eyebrow?: string | null;
  blocks: MarkdownBlock[];
  initialComments: ReviewComment[];
  currentUserId: string;
  canComment: boolean;
  downloadUrl?: string | null;
  downloadName?: string | null;
  // Inline (preview) URL of the original file. Rendered when there is no
  // extracted markdown to show — e.g. an image/scanned PDF — so an uploaded
  // deliverable is never hidden and whole-document comments still work.
  fileUrl?: string | null;
  // Set only on the internal admin review surface, where the staff member has
  // no brand membership; threaded into every comment mutation so the server can
  // resolve (and re-verify) the brand. Undefined for client-membership callers.
  contextBrandId?: string;
  decision?: ReviewDecision | null;
  actions: ReviewCommentActions;
}) {
  const [comments, setComments] = useState<ReviewComment[]>(initialComments);
  const [target, setTarget] = useState<Target>({ anchorId: null, label: null });
  const [showComments, setShowComments] = useState(true);
  // The comment whose highlight is painted "active" (selected in the rail or
  // clicked on the page).
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  // The live selection awaiting a "Comment" click, then its inline composer.
  const [selection, setSelection] = useState<PendingSelection | null>(null);
  const [composing, setComposing] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Bind the admin-context brand into every mutation once, so the comment
  // sub-components don't each need to know about it.
  const boundActions = useMemo<ReviewCommentActions>(() => {
    if (!contextBrandId) return actions;
    return {
      add: (input) => actions.add({ ...input, brandId: contextBrandId }),
      edit: (args) => actions.edit({ ...args, brandId: contextBrandId }),
      remove: (args) => actions.remove({ ...args, brandId: contextBrandId }),
      resolve: (args) => actions.resolve({ ...args, brandId: contextBrandId }),
    };
  }, [actions, contextBrandId]);

  const countByAnchor = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) {
      if (c.parentId) continue;
      const key = anchorKey(c.anchorId);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [comments]);

  // Every root comment, newest last — the rail shows the whole document's
  // thread (the Figma comments column is not section-filtered).
  const rootComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments],
  );

  const repliesByParent = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  }, [comments]);

  const upsertComment = useCallback((comment: ReviewComment) => {
    setComments((prev) => [...prev, comment]);
  }, []);
  const patchComment = useCallback(
    (id: string, patch: Partial<ReviewComment>) => {
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );
  const removeComment = useCallback((id: string) => {
    setComments((prev) =>
      prev.filter((c) => c.id !== id && c.parentId !== id),
    );
  }, []);

  // The rendered markdown container for a block anchor (the basis for offsets,
  // painting, and scroll). Scoped to this viewer so anchors never collide with
  // another surface on the page.
  const blockElement = useCallback((anchorId: string): HTMLElement | null => {
    const root = contentRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>(
      `[data-block-content="${CSS.escape(anchorId)}"]`,
    );
  }, []);

  // Resolve a stored comment range against the current DOM, re-anchoring via the
  // quoted text if the offsets have drifted (e.g. after a re-export).
  const rangeForComment = useCallback(
    (comment: ReviewComment): Range | null => {
      if (
        !comment.anchorId ||
        comment.highlightStart == null ||
        comment.highlightEnd == null
      ) {
        return null;
      }
      const el = blockElement(comment.anchorId);
      if (!el) return null;
      let range = createRangeFromOffsets(
        el,
        comment.highlightStart,
        comment.highlightEnd,
      );
      const quote = comment.highlightText;
      if (quote && (!range || range.toString() !== quote)) {
        const alt = findQuoteOffsets(el, quote);
        if (alt) range = createRangeFromOffsets(el, alt.start, alt.end);
      }
      return range;
    },
    [blockElement],
  );

  // Paint every highlight via the CSS Custom Highlight API — no DOM mutation, so
  // the markdown renderer is untouched. Re-runs whenever the comment set or the
  // active selection changes.
  useEffect(() => {
    if (!supportsHighlightApi()) return;
    const muted = new Highlight();
    const active = new Highlight();
    for (const comment of comments) {
      if (comment.parentId || comment.highlightStart == null) continue;
      const range = rangeForComment(comment);
      if (!range) continue;
      if (comment.id === activeCommentId) active.add(range);
      else muted.add(range);
    }
    CSS.highlights.set(HIGHLIGHT_NAME, muted);
    CSS.highlights.set(HIGHLIGHT_ACTIVE_NAME, active);
    return () => {
      CSS.highlights.delete(HIGHLIGHT_NAME);
      CSS.highlights.delete(HIGHLIGHT_ACTIVE_NAME);
    };
  }, [comments, activeCommentId, rangeForComment]);

  // Capture a text selection inside a single block and offer it as a highlight
  // anchor. Selections that are collapsed, escape a block, or span two blocks
  // are ignored.
  const captureSelection = useCallback(() => {
    if (!canComment) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelection(null);
      setComposing(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const startBlock = (range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
    )?.closest<HTMLElement>("[data-block-content]");
    const endBlock = (range.endContainer instanceof Element
      ? range.endContainer
      : range.endContainer.parentElement
    )?.closest<HTMLElement>("[data-block-content]");
    if (!startBlock || startBlock !== endBlock) {
      setSelection(null);
      return;
    }
    const offsets = getSelectionOffsets(startBlock, range);
    if (!offsets) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelection({
      anchorId: startBlock.dataset.blockContent ?? "",
      label: startBlock.dataset.blockLabel || null,
      highlight: { ...offsets, text: range.toString() },
      rect: { top: rect.top, left: rect.left, width: rect.width },
    });
    setComposing(false);
  }, [canComment]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    setComposing(false);
    window.getSelection()?.removeAllRanges();
  }, []);

  const scrollToComment = useCallback(
    (comment: ReviewComment) => {
      const range = rangeForComment(comment);
      const el =
        range?.startContainer.parentElement ??
        (comment.anchorId ? blockElement(comment.anchorId) : null);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [rangeForComment, blockElement],
  );

  // Selecting a comment paints its highlight active, reveals the rail, focuses
  // its section thread, and scrolls the highlight into view.
  const activateComment = useCallback(
    (comment: ReviewComment) => {
      setActiveCommentId(comment.id);
      setShowComments(true);
      if (comment.highlightStart != null) {
        setTarget({ anchorId: comment.anchorId, label: comment.anchorLabel });
        scrollToComment(comment);
      }
    },
    [scrollToComment],
  );

  // Reverse direction: clicking a painted highlight on the page selects its
  // comment. Ignored while text is being selected.
  const handleContentClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      const root = contentRef.current;
      if (!root) return;
      const block = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-block-content]",
      );
      if (!block) return;
      const offset = offsetUnderPoint(block, event.clientX, event.clientY);
      if (offset == null) return;
      const hit = comments.find(
        (c) =>
          !c.parentId &&
          c.anchorId === block.dataset.blockContent &&
          c.highlightStart != null &&
          c.highlightEnd != null &&
          offset >= c.highlightStart &&
          offset < c.highlightEnd,
      );
      if (hit) activateComment(hit);
      else setActiveCommentId(null);
    },
    [comments, activateComment],
  );

  const [creatingHighlight, startCreateHighlight] = useTransition();
  const [highlightError, setHighlightError] = useState<string | null>(null);

  const createHighlightComment = useCallback(
    (body: string) => {
      if (!selection || !body.trim()) return;
      setHighlightError(null);
      startCreateHighlight(async () => {
        const result = await boundActions.add({
          subjectType,
          subjectId,
          anchorId: selection.anchorId,
          anchorLabel: selection.label,
          highlight: selection.highlight,
          body,
          parentId: null,
        });
        if (result.ok) {
          upsertComment(result.comment);
          setActiveCommentId(result.comment.id);
          setTarget({
            anchorId: result.comment.anchorId,
            label: result.comment.anchorLabel,
          });
          clearSelection();
        } else {
          setHighlightError(result.message);
        }
      });
    },
    [
      selection,
      boundActions,
      subjectType,
      subjectId,
      upsertComment,
      clearSelection,
    ],
  );

  const isPdfOnly = blocks.length === 0 && Boolean(fileUrl);

  return (
    <main className="w-full pt-[15px]">
      <style dangerouslySetInnerHTML={{ __html: HIGHLIGHT_STYLES }} />
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
        {/* Left column — header, hint, the framed document/PDF area, and the
            centred Approve action. Centred in the space beside the rail. */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-6 px-2 sm:px-6">
          <div className="flex w-full max-w-[708px] flex-col gap-4">
            {/* Report header */}
            <div className="flex flex-col gap-[9px]">
              <div className="flex flex-wrap items-center gap-4">
                {eyebrow ? (
                  <span className="text-[12px] leading-4 tracking-[-0.072px] text-muted-foreground">
                    {eyebrow}
                  </span>
                ) : null}
                {statusBadge}
              </div>
              <h1 className="text-[20px] font-semibold leading-7 text-foreground">
                {title}
              </h1>
              {description ? (
                <p className="max-w-[545px] text-[12px] leading-4 tracking-[-0.072px] text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>

            {/* Comment instruction */}
            {canComment ? (
              <div className="flex items-center gap-[9px]">
                <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-[12px] font-light leading-4 text-muted-foreground">
                  Click anywhere on the page to add a comment.
                </span>
              </div>
            ) : null}

            {/* Pdf area — the framed document. Holds either the original file
                (image-based PDFs) or the extracted markdown, with inline
                text-selection commenting. */}
            <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card shadow-xs">
              {isPdfOnly ? (
                <iframe
                  className="h-[479px] w-full lg:h-[70vh]"
                  src={fileUrl ?? undefined}
                  title={`${title} preview`}
                />
              ) : (
                <div
                  className="flex min-h-[479px] flex-col gap-4 p-4 sm:p-6"
                  onClick={handleContentClick}
                  onMouseUp={captureSelection}
                  ref={contentRef}
                >
                  {blocks.map((block) => {
                    const count =
                      countByAnchor.get(anchorKey(block.anchorId)) ?? 0;
                    const isActive = target.anchorId === block.anchorId;
                    return (
                      <section
                        className={cn(
                          "group relative scroll-mt-24 rounded-lg px-3 py-1 transition-colors",
                          isActive && ACTIVE_SECTION_CLASS,
                        )}
                        id={block.anchorId}
                        key={block.anchorId}
                      >
                        <button
                          aria-label="Comment on this section"
                          className={cn(
                            "absolute end-0 top-2 z-10 flex items-center gap-1 rounded-full border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100",
                            count > 0 && "opacity-100",
                            isActive && ACTIVE_MARKER_CLASS,
                          )}
                          onClick={() =>
                            setTarget({
                              anchorId: block.anchorId,
                              label: block.label,
                            })
                          }
                          type="button"
                        >
                          <MessageSquarePlusIcon className="size-3.5" />
                          {count > 0 ? count : "Comment"}
                        </button>
                        <div
                          data-block-content={block.anchorId}
                          data-block-label={block.label ?? undefined}
                        >
                          <MarkdownContent markdown={block.markdown} />
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Centred Approve action */}
          {decision?.canDecide ? (
            <DecisionBar decision={decision} />
          ) : decision?.isApproved ? (
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                <CheckCircle2Icon className="size-4" /> You approved this
                document.
              </span>
            </div>
          ) : null}
        </div>

        {/* Right column — download + comments, anchored to the right edge. */}
        <aside className="flex w-full shrink-0 flex-col gap-4 lg:sticky lg:top-2 lg:w-[244px] lg:py-4">
          <div className="flex items-center justify-end gap-4">
            {downloadUrl ? (
              <Button
                asChild
                className="size-9"
                size="icon"
                title="Download original"
                variant="secondary"
              >
                <a href={downloadUrl} download={downloadName ?? undefined}>
                  <DownloadIcon className="size-4" />
                </a>
              </Button>
            ) : null}
            <Button
              aria-pressed={showComments}
              className="h-9 flex-1 justify-center lg:w-[184px] lg:flex-none"
              onClick={() => setShowComments((value) => !value)}
              type="button"
              variant="secondary"
            >
              Comments
              <ChevronsUpDownIcon className="size-4" />
            </Button>
          </div>

          {showComments ? (
            <div className="flex flex-col gap-3">
              {rootComments.length === 0 ? (
                <p className="rounded-[10px] border border-border bg-card px-3 py-6 text-center text-[12px] text-muted-foreground shadow-xs">
                  No comments yet.
                </p>
              ) : (
                rootComments.map((root) => (
                  <CommentThread
                    actions={boundActions}
                    currentUserId={currentUserId}
                    isActive={root.id === activeCommentId}
                    key={root.id}
                    onActivate={activateComment}
                    onAdd={upsertComment}
                    onPatch={patchComment}
                    onRemove={removeComment}
                    replies={repliesByParent.get(root.id) ?? []}
                    root={root}
                    subjectId={subjectId}
                    subjectType={subjectType}
                  />
                ))
              )}

              {canComment ? (
                <div className="rounded-[10px] border border-border bg-card p-2.5 shadow-xs">
                  {target.anchorId ? (
                    <p
                      className="mb-2 truncate text-[11px] text-muted-foreground"
                      dir="auto"
                    >
                      On: {target.label ?? "Selected section"}
                    </p>
                  ) : null}
                  <AddCommentForm
                    anchorId={target.anchorId}
                    anchorLabel={target.label}
                    onAdd={upsertComment}
                    onSubmit={boundActions.add}
                    subjectId={subjectId}
                    subjectType={subjectType}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      {selection ? (
        <SelectionPopover
          composing={composing}
          error={highlightError}
          onCancel={clearSelection}
          onStartComposing={() => setComposing(true)}
          onSubmit={createHighlightComment}
          pending={creatingHighlight}
          rect={selection.rect}
        />
      ) : null}
    </main>
  );
}

// The Google-Docs-style floating control over a text selection: first a small
// "Comment" pill, then an inline composer once clicked. Positioned in viewport
// coordinates (the rect comes from Range.getBoundingClientRect).
function SelectionPopover({
  rect,
  composing,
  pending,
  error,
  onStartComposing,
  onSubmit,
  onCancel,
}: {
  rect: { top: number; left: number; width: number };
  composing: boolean;
  pending: boolean;
  error: string | null;
  onStartComposing: () => void;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");

  if (!composing) {
    return (
      <div
        className="fixed z-50 -translate-x-1/2"
        style={{
          top: Math.max(8, rect.top - 44),
          left: rect.left + rect.width / 2,
        }}
      >
        <Button
          onClick={onStartComposing}
          onMouseDown={(e) => e.preventDefault()}
          size="sm"
          type="button"
        >
          <MessageSquarePlusIcon className="size-4" /> Comment
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 w-72 -translate-x-1/2 rounded-[10px] border border-border bg-popover p-3 shadow-md"
      onMouseUp={(e) => e.stopPropagation()}
      style={{
        top: rect.top + 12,
        left: Math.max(160, rect.left + rect.width / 2),
      }}
    >
      <Textarea
        autoFocus
        className="min-h-[64px] text-sm"
        dir="auto"
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a comment…"
        value={body}
      />
      {error ? (
        <p className="mt-1 text-[12px] text-destructive">{error}</p>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancel
        </Button>
        <Button
          disabled={pending || !body.trim()}
          onClick={() => onSubmit(body)}
          size="sm"
          type="button"
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Comment
        </Button>
      </div>
    </div>
  );
}

function DecisionBar({ decision }: { decision: ReviewDecision }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.message ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        className="h-10 rounded-md px-8"
        disabled={pending}
        onClick={() => run(decision.onApprove)}
        type="button"
      >
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        Approve
      </Button>
      <button
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        disabled={pending}
        onClick={() => run(decision.onRequestChanges)}
        type="button"
      >
        <RotateCcwIcon className="size-3.5" /> Request changes
      </button>
      {error ? (
        <span className="text-[12px] text-destructive">{error}</span>
      ) : null}
    </div>
  );
}

function AddCommentForm({
  subjectType,
  subjectId,
  anchorId,
  anchorLabel,
  parentId,
  placeholder,
  onAdd,
  onSubmit,
  onDone,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  anchorId: string | null;
  anchorLabel: string | null;
  parentId?: string | null;
  placeholder?: string;
  onAdd: (comment: ReviewComment) => void;
  onSubmit: (input: AddReviewCommentInput) => Promise<AddReviewCommentResult>;
  onDone?: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await onSubmit({
        subjectType,
        subjectId,
        anchorId,
        anchorLabel,
        body,
        parentId: parentId ?? null,
      });
      if (result.ok) {
        onAdd(result.comment);
        setBody("");
        onDone?.();
      } else {
        setError(result.message);
      }
    });
  };

  return (
    <div className="space-y-2">
      <Textarea
        className="min-h-[60px] text-sm"
        dir="auto"
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? "Add a comment…"}
        value={body}
      />
      {error ? <p className="text-[12px] text-destructive">{error}</p> : null}
      <div className="flex items-center justify-end gap-2">
        {onDone ? (
          <Button onClick={onDone} size="sm" type="button" variant="ghost">
            Cancel
          </Button>
        ) : null}
        <Button
          disabled={pending || !body.trim()}
          onClick={submit}
          size="sm"
          type="button"
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {parentId ? "Reply" : "Comment"}
        </Button>
      </div>
    </div>
  );
}

// A root comment rendered as a Figma comment card: author/date header with an
// ellipsis action menu, the body, the "Solved" status, then nested replies and
// an inline reply composer.
function CommentThread({
  subjectType,
  subjectId,
  root,
  replies,
  currentUserId,
  actions,
  isActive,
  onActivate,
  onAdd,
  onPatch,
  onRemove,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  root: ReviewComment;
  replies: ReviewComment[];
  currentUserId: string;
  actions: ReviewCommentActions;
  isActive: boolean;
  onActivate: (comment: ReviewComment) => void;
  onAdd: (comment: ReviewComment) => void;
  onPatch: (id: string, patch: Partial<ReviewComment>) => void;
  onRemove: (id: string) => void;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div
      className={cn(
        "cursor-pointer rounded-[10px] border border-border bg-card p-2.5 shadow-xs transition-colors",
        isActive && "border-amber-300 bg-amber-50/60",
        root.resolved && "opacity-80",
      )}
      onClick={() => onActivate(root)}
    >
      {root.highlightText ? (
        <p
          className="mb-2 line-clamp-2 border-s-2 border-amber-300 ps-2 text-[12px] text-muted-foreground"
          dir="auto"
        >
          {root.highlightText}
        </p>
      ) : null}

      <CommentItem
        actions={actions}
        canResolve
        comment={root}
        currentUserId={currentUserId}
        onPatch={onPatch}
        onRemove={onRemove}
        onReply={() => setReplying((value) => !value)}
        subjectId={subjectId}
        subjectType={subjectType}
      />

      {replies.length > 0 ? (
        <div className="mt-2 space-y-2 border-s border-border ps-3">
          {replies.map((reply) => (
            <CommentItem
              actions={actions}
              canResolve={false}
              comment={reply}
              currentUserId={currentUserId}
              key={reply.id}
              onPatch={onPatch}
              onRemove={onRemove}
              subjectId={subjectId}
              subjectType={subjectType}
            />
          ))}
        </div>
      ) : null}

      {replying ? (
        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
          <AddCommentForm
            anchorId={root.anchorId}
            anchorLabel={root.anchorLabel}
            onAdd={onAdd}
            onDone={() => setReplying(false)}
            onSubmit={actions.add}
            parentId={root.id}
            placeholder="Write a reply…"
            subjectId={subjectId}
            subjectType={subjectType}
          />
        </div>
      ) : null}
    </div>
  );
}

function CommentItem({
  subjectType,
  subjectId,
  comment,
  currentUserId,
  canResolve,
  actions,
  onPatch,
  onRemove,
  onReply,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  comment: ReviewComment;
  currentUserId: string;
  canResolve: boolean;
  actions: ReviewCommentActions;
  onPatch: (id: string, patch: Partial<ReviewComment>) => void;
  onRemove: (id: string) => void;
  // Present on root comments only — toggles the inline reply composer.
  onReply?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isOwn = comment.authorId === currentUserId;

  const saveEdit = () => {
    if (!draft.trim()) return;
    setActionError(null);
    startTransition(async () => {
      const result = await actions.edit({
        subjectType,
        subjectId,
        commentId: comment.id,
        body: draft,
      });
      if (result.ok) {
        onPatch(comment.id, { body: draft.trim() });
        setEditing(false);
      } else {
        setActionError(result.message ?? "Could not update the comment.");
      }
    });
  };

  const doDelete = () => {
    setActionError(null);
    startTransition(async () => {
      const result = await actions.remove({
        subjectType,
        subjectId,
        commentId: comment.id,
      });
      if (result.ok) {
        onRemove(comment.id);
      } else {
        setActionError(result.message ?? "Could not delete the comment.");
      }
    });
  };

  const toggleResolve = () => {
    const next = !comment.resolved;
    setActionError(null);
    startTransition(async () => {
      const result = await actions.resolve({
        subjectType,
        subjectId,
        commentId: comment.id,
        resolved: next,
      });
      if (result.ok) {
        onPatch(comment.id, { resolved: next });
      } else {
        setActionError(result.message ?? "Could not update the comment.");
      }
    });
  };

  const hasMenu = Boolean(onReply) || isOwn || canResolve;

  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[12px] font-medium leading-none text-card-foreground">
            {authorLabel(comment)}
          </span>
          <span className="text-[12px] font-light leading-4 text-muted-foreground">
            {formatDate(comment.createdAt)}
          </span>
        </div>

        {hasMenu && !editing ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Comment actions"
                className="-mr-1 -mt-1 size-7 text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <EllipsisIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-32"
              onClick={(e) => e.stopPropagation()}
            >
              {onReply ? (
                <DropdownMenuItem onSelect={() => onReply()}>
                  <ReplyIcon className="size-4" />
                  Reply
                </DropdownMenuItem>
              ) : null}
              {isOwn ? (
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <PencilIcon className="size-4" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {canResolve ? (
                <DropdownMenuItem disabled={pending} onSelect={toggleResolve}>
                  {comment.resolved ? (
                    <RotateCcwIcon className="size-4" />
                  ) : (
                    <CheckCircle2Icon className="size-4" />
                  )}
                  {comment.resolved ? "Reopen" : "Resolve"}
                </DropdownMenuItem>
              ) : null}
              {isOwn ? (
                <DropdownMenuItem disabled={pending} onSelect={doDelete}>
                  <Trash2Icon className="size-4" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-1.5 space-y-2" onClick={(e) => e.stopPropagation()}>
          <Textarea
            className="min-h-[56px] text-sm"
            dir="auto"
            onChange={(e) => setDraft(e.target.value)}
            value={draft}
          />
          <div className="flex justify-end gap-2">
            <Button
              aria-label="Cancel editing"
              onClick={() => {
                setDraft(comment.body);
                setEditing(false);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <XIcon className="size-4" />
            </Button>
            <Button disabled={pending} onClick={saveEdit} size="sm" type="button">
              <CheckIcon className="size-4" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p
          className="mt-2 whitespace-pre-wrap text-[12px] leading-4 text-muted-foreground"
          dir="auto"
        >
          {comment.body}
        </p>
      )}

      {actionError ? (
        <p className="mt-1 text-[12px] text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {!editing && canResolve && comment.resolved ? (
        <p className={cn("mt-2 text-[12px] font-medium leading-4", SOLVED_COLOR)}>
          Solved
        </p>
      ) : null}
    </div>
  );
}
