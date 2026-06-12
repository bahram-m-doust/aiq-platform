"use client";

import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  CheckCircle2Icon,
  CheckIcon,
  DownloadIcon,
  Loader2Icon,
  MessageSquarePlusIcon,
  PencilIcon,
  ReplyIcon,
  RotateCcwIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  AddReviewCommentInput,
  AddReviewCommentResult,
  ReviewComment,
  ReviewCommentMutationResult,
  ReviewSubjectType,
} from "@/features/review-comments/types";
import type { MarkdownBlock } from "@/lib/markdown/blocks";
import { cn } from "@/lib/utils";

const GENERAL_KEY = "__general__";

// "Active section" comment highlight. Amber deliberately sits apart from the
// cyan brand so a selected/commented section reads as a comment marker (the
// Google-Docs convention), not as a primary action.
const ACTIVE_SECTION_CLASS = "bg-amber-50/60 ring-1 ring-amber-200";
const ACTIVE_MARKER_CLASS = "border-amber-300 text-amber-700";

export type ReviewCommentActions = {
  add: (input: AddReviewCommentInput) => Promise<AddReviewCommentResult>;
  edit: (args: {
    subjectType: string;
    subjectId: string;
    commentId: string;
    body: string;
  }) => Promise<ReviewCommentMutationResult>;
  remove: (args: {
    subjectType: string;
    subjectId: string;
    commentId: string;
  }) => Promise<ReviewCommentMutationResult>;
  resolve: (args: {
    subjectType: string;
    subjectId: string;
    commentId: string;
    resolved: boolean;
  }) => Promise<ReviewCommentMutationResult>;
};

export type ReviewDecision = {
  canDecide: boolean;
  isApproved: boolean;
  onApprove: () => Promise<{ ok: boolean; message?: string }>;
  onRequestChanges: () => Promise<{ ok: boolean; message?: string }>;
};

type Target = { anchorId: string | null; label: string | null };

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
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
  decision?: ReviewDecision | null;
  actions: ReviewCommentActions;
}) {
  const [comments, setComments] = useState<ReviewComment[]>(initialComments);
  const [target, setTarget] = useState<Target>({ anchorId: null, label: null });

  const countByAnchor = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of comments) {
      if (c.parentId) continue;
      const key = anchorKey(c.anchorId);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [comments]);

  const selectedRoots = useMemo(() => {
    const key = anchorKey(target.anchorId);
    return comments.filter(
      (c) => !c.parentId && anchorKey(c.anchorId) === key,
    );
  }, [comments, target.anchorId]);

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

  return (
    <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          {eyebrow ? (
            <p className="ds-eyebrow">{eyebrow}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {statusBadge}
          </div>
          {description ? (
            <p className="max-w-xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {downloadUrl ? (
            <Button asChild size="sm" variant="outline">
              <a href={downloadUrl} download={downloadName ?? undefined}>
                <DownloadIcon className="size-4" />
                Download original
              </a>
            </Button>
          ) : null}
        </div>
      </header>

      {decision?.canDecide ? (
        <DecisionBar decision={decision} />
      ) : decision?.isApproved ? (
        <p className="mb-6 flex items-center gap-2 text-[13px] font-medium text-emerald-700">
          <CheckCircle2Icon className="size-4" /> You approved this document.
        </p>
      ) : null}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Content */}
        <div className="min-w-0 flex-1">
          {blocks.length === 0 && fileUrl ? (
            <div className="space-y-2">
              <p className="text-[13px] text-muted-foreground">
                No text could be extracted from this file (it may be image-based).
                The original is shown below — use the comment panel to leave
                notes on the document.
              </p>
              <div className="overflow-hidden rounded-lg border border-border bg-white">
                <iframe
                  className="h-[78vh] w-full"
                  src={fileUrl}
                  title={`${title} preview`}
                />
              </div>
            </div>
          ) : null}
          {blocks.map((block) => {
            const count = countByAnchor.get(anchorKey(block.anchorId)) ?? 0;
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
                <MarkdownContent markdown={block.markdown} />
              </section>
            );
          })}
        </div>

        {/* Comment rail */}
        <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[360px]">
          <div className="rounded-xl border border-border bg-card">
            <CommentRail
              actions={actions}
              canComment={canComment}
              currentUserId={currentUserId}
              onAdd={upsertComment}
              onPatch={patchComment}
              onRemove={removeComment}
              repliesByParent={repliesByParent}
              roots={selectedRoots}
              subjectId={subjectId}
              subjectType={subjectType}
              target={target}
            />
          </div>
          <SectionNav
            blocks={blocks}
            countByAnchor={countByAnchor}
            generalCount={countByAnchor.get(GENERAL_KEY) ?? 0}
            onSelect={setTarget}
            target={target}
          />
        </aside>
      </div>
    </main>
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
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <span className="me-1 text-sm font-medium">Ready to decide?</span>
      <Button
        disabled={pending}
        onClick={() => run(decision.onApprove)}
        size="sm"
        type="button"
      >
        <CheckIcon className="size-4" /> Approve
      </Button>
      <Button
        disabled={pending}
        onClick={() => run(decision.onRequestChanges)}
        size="sm"
        type="button"
        variant="outline"
      >
        <RotateCcwIcon className="size-4" /> Request changes
      </Button>
      {error ? <span className="text-[12px] text-destructive">{error}</span> : null}
    </div>
  );
}

function SectionNav({
  blocks,
  countByAnchor,
  generalCount,
  target,
  onSelect,
}: {
  blocks: MarkdownBlock[];
  countByAnchor: Map<string, number>;
  generalCount: number;
  target: Target;
  onSelect: (target: Target) => void;
}) {
  const withComments = blocks.filter(
    (b) => (countByAnchor.get(anchorKey(b.anchorId)) ?? 0) > 0,
  );
  if (withComments.length === 0 && generalCount === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sections with comments
      </p>
      <ul className="space-y-0.5">
        <li>
          <button
            className={cn(
              "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-start text-[13px] hover:bg-muted",
              target.anchorId === null && "bg-muted font-medium",
            )}
            onClick={() => onSelect({ anchorId: null, label: null })}
            type="button"
          >
            <span>General</span>
            {generalCount > 0 ? (
              <span className="text-muted-foreground">{generalCount}</span>
            ) : null}
          </button>
        </li>
        {withComments.map((b) => (
          <li key={b.anchorId}>
            <button
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start text-[13px] hover:bg-muted",
                target.anchorId === b.anchorId && "bg-muted font-medium",
              )}
              onClick={() =>
                onSelect({ anchorId: b.anchorId, label: b.label })
              }
              type="button"
            >
              <span className="truncate" dir="auto">
                {b.label ?? "Section"}
              </span>
              <span className="text-muted-foreground">
                {countByAnchor.get(anchorKey(b.anchorId))}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommentRail({
  subjectType,
  subjectId,
  target,
  roots,
  repliesByParent,
  currentUserId,
  canComment,
  actions,
  onAdd,
  onPatch,
  onRemove,
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  target: Target;
  roots: ReviewComment[];
  repliesByParent: Map<string, ReviewComment[]>;
  currentUserId: string;
  canComment: boolean;
  actions: ReviewCommentActions;
  onAdd: (comment: ReviewComment) => void;
  onPatch: (id: string, patch: Partial<ReviewComment>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex max-h-[78vh] flex-col">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">Comments</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground" dir="auto">
          {target.anchorId ? (target.label ?? "Selected section") : "Whole document"}
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {roots.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted-foreground">
            No comments here yet.
          </p>
        ) : (
          roots.map((root) => (
            <CommentThread
              actions={actions}
              currentUserId={currentUserId}
              key={root.id}
              onAdd={onAdd}
              onPatch={onPatch}
              onRemove={onRemove}
              replies={repliesByParent.get(root.id) ?? []}
              root={root}
              subjectId={subjectId}
              subjectType={subjectType}
            />
          ))
        )}
      </div>

      {canComment ? (
        <div className="border-t border-border px-4 py-3">
          <AddCommentForm
            anchorId={target.anchorId}
            anchorLabel={target.label}
            onAdd={onAdd}
            onSubmit={actions.add}
            subjectId={subjectId}
            subjectType={subjectType}
          />
        </div>
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
        className="min-h-[64px] text-sm"
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

function CommentThread({
  subjectType,
  subjectId,
  root,
  replies,
  currentUserId,
  actions,
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
  onAdd: (comment: ReviewComment) => void;
  onPatch: (id: string, patch: Partial<ReviewComment>) => void;
  onRemove: (id: string) => void;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border border-border p-3",
        root.resolved && "bg-muted/40 opacity-70",
      )}
    >
      <CommentItem
        actions={actions}
        canResolve
        comment={root}
        currentUserId={currentUserId}
        onPatch={onPatch}
        onRemove={onRemove}
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
        <div className="mt-2">
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
      ) : (
        <button
          className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          onClick={() => setReplying(true)}
          type="button"
        >
          <ReplyIcon className="size-3.5" /> Reply
        </button>
      )}
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
}: {
  subjectType: ReviewSubjectType;
  subjectId: string;
  comment: ReviewComment;
  currentUserId: string;
  canResolve: boolean;
  actions: ReviewCommentActions;
  onPatch: (id: string, patch: Partial<ReviewComment>) => void;
  onRemove: (id: string) => void;
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

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{authorLabel(comment)}</span>
        <span className="text-[11px] text-muted-foreground">
          {formatDate(comment.createdAt)}
        </span>
      </div>

      {editing ? (
        <div className="mt-1.5 space-y-2">
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
            <Button
              disabled={pending}
              onClick={saveEdit}
              size="sm"
              type="button"
            >
              <CheckIcon className="size-4" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90" dir="auto">
          {comment.body}
        </p>
      )}

      {actionError ? (
        <p className="mt-1 text-[12px] text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {!editing ? (
        <div className="mt-1.5 flex items-center gap-3 text-[12px] text-muted-foreground">
          {canResolve ? (
            <button
              className="flex items-center gap-1 hover:text-foreground"
              disabled={pending}
              onClick={toggleResolve}
              type="button"
            >
              <CheckCircle2Icon className="size-3.5" />
              {comment.resolved ? "Reopen" : "Resolve"}
            </button>
          ) : null}
          {isOwn ? (
            <>
              <button
                className="flex items-center gap-1 hover:text-foreground"
                onClick={() => setEditing(true)}
                type="button"
              >
                <PencilIcon className="size-3.5" /> Edit
              </button>
              <button
                className="flex items-center gap-1 hover:text-destructive"
                disabled={pending}
                onClick={doDelete}
                type="button"
              >
                <Trash2Icon className="size-3.5" /> Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
