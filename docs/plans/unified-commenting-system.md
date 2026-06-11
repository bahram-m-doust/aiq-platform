# Unified Commenting & Notifications System — Implementation Plan

> Goal: every reviewable deliverable in the platform (everything **except** the
> client-filled Questionnaire) renders through **one** viewer and supports
> **block-anchored** comments. Every comment (and review decision) raises a
> **notification** to the internal/admin team, deep-linked to the exact section,
> so they can act on requested changes. The old PDF-coordinate annotation system
> is removed.

## 1. Why the old model is replaced

The current comment system (`stakeholder_interview_annotations`,
`futures_research_annotations`) anchors comments to **PDF pixel coordinates**
(`page`, `pos_x 0..1`, `pos_y 0..1`). This is the wrong primitive:

- breaks on reflow / responsive / RTL,
- breaks whenever the deliverable is re-exported by the brand skills,
- has **no mapping to RAG chunks** — comments and brand knowledge stay in two
  disconnected worlds.

"Comment on every section" means **block-anchored** comments (à la Notion /
Google Docs), keyed to a stable section anchor (a slug of the heading), not a
pixel. The same anchor maps 1:1 to a RAG chunk.

## 2. Surfaces in scope

| Surface | subject_type | Source content |
|---|---|---|
| Stakeholder Interviews | `STAKEHOLDER_INTERVIEWS` | markdown (preferred) / PDF text |
| Futures Research | `FUTURES_RESEARCH` | markdown / PDF text |
| City Model districts | `CITY_MODEL_DISTRICT` | markdown / docx text |
| Modules (client review) | `MODULE` | markdown / PDF text |
| Visual System & other brand-twin files | `BRAND_DOC` | markdown |
| **Questionnaire** | — | **OUT OF SCOPE** (user fills it themselves) |

## 3. Data model — migration `0041_unified_commenting.sql`

New, additive tables (do **not** rewrite the working upload RPCs):

- `review_comments` — polymorphic (`subject_type`, `subject_id`), threaded
  (`parent_id`), block-anchored (`anchor_id`, `anchor_label`), `resolved`,
  author + timestamps. `brand_id` for scoping.
- `notifications` — `brand_id`, `audience` (`ADMIN`/`INTERNAL_TEAM`/`CLIENT`),
  `recipient_id?`, `type`, `title`, `body`, `link_path` (deep link incl.
  `#anchor`), `subject_type`/`subject_id`, `comment_id?`, `actor_id`, `read_at`.

Then **drop** the old coordinate tables: `stakeholder_interview_annotations`,
`futures_research_annotations` (+ their indexes). Report/upload tables stay.

RLS deny-by-default (all access via admin client behind app authz), matching the
rest of the schema.

## 4. Backend features

### `features/review-comments/`
- `schema.ts` — `subject_type` union, body validation (reuse 4000-char limit),
  anchor helpers.
- `mutation-service.ts` — `createComment` / `editComment` / `deleteComment` /
  `setCommentResolved`; **createComment also emits a notification** to the
  internal team (transactional helper).
- `queries.ts` — `listCommentsForSubject(subjectType, subjectId)` returning
  threads grouped by `anchor_id`.
- `actions.ts` — server actions guarded by reviewer/admin authz.

### `features/notifications/`
- `queries.ts` — `getUnreadCount(profileId)`, `listNotifications(profileId)`.
- `mutation-service.ts` — `createNotification`, `markRead`, `markAllRead`.
- `actions.ts` — `markNotificationReadAction`, `markAllNotificationsReadAction`.

## 5. Markdown rendering
- Add deps: `react-markdown`, `remark-gfm`, `rehype-sanitize`.
- `lib/markdown/blocks.ts` — split markdown into sections on top-level headings;
  each section → `{ anchorId: slug(heading), label, markdown }` with index
  fallback for stable anchors.
- `components/markdown/MarkdownContent.tsx` — RTL-aware (`dir="auto"` per block)
  renderer used everywhere.

## 6. Unified viewer — `components/review/ReviewableDocumentViewer.tsx`
- Input: `blocks[]` + `comments[]` + `subject` + `actions` + `canReview`.
- Renders each block; a gutter comment affordance per section opens that anchor's
  thread; a side panel lists all threads; whole-document comments supported.
- Retains Approve / Request-changes. Replaces the per-feature `PdfAnnotator` and
  the raw `<iframe>` viewers (City Model, Module). Original file remains
  downloadable for visual fidelity.

## 7. Notifications UI
- Wire the (currently dead) bell in `AppNavbar` to a real dropdown: unread badge,
  list, mark-read, deep links. Server data passed from the app layout.

## 8. RAG
- Ingest the **`.md`** the brand skills already emit, instead of regex-stripping
  docx XML in `text-extractor.ts`. Markdown preserves heading hierarchy → chunk
  per section → anchor shared with comments.

## 9. Sequencing (each step type-checks before the next)
1. Plan doc (this file). ✅
2. Migration `0041` (additive tables) + deps.
3. `review-comments` feature (service + queries + actions).
4. `notifications` feature (service + queries + actions).
5. Markdown blocks helper + `MarkdownContent`.
6. `ReviewableDocumentViewer`.
7. Notifications bell UI.
8. Wire surfaces (city-model → modules → stakeholder → futures → brand docs).
9. Drop old annotation tables + delete `PdfAnnotator` and dead coordinate code.
10. RAG `.md`-first ingestion.

## 10. Open risks
- **RTL/bidi**: Persian + Latin + digits mixed → `dir="auto"` per block, unicode
  normalize.
- **Anchor drift on re-export**: slug + fuzzy heading-text re-anchoring fallback.
- **PDF-only surfaces**: anchors fall back to per-page sections until a `.md`
  source exists.
