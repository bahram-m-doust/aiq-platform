# Bextudio Platform — Architecture Map

A "what's where and how it works" inventory. Paths are relative to the platform
root. `features/X` = domain logic; `app/(app)` = client area; `app/(admin)` =
internal/admin area.

## Tech stack
- **Next.js 16 (App Router)** + React 19 + TypeScript. Most routes are
  `force-dynamic` (server-rendered per request).
- **Supabase**: Auth (Google OAuth), Postgres (RLS deny-by-default, all access
  via service-role admin client behind app-level authz), private file Storage
  (bucket `bextudio-files`), pgvector for embeddings.
- **Tailwind CSS 4** + shadcn/ui (`components/ui/*`).
- **OpenRouter** (OpenAI SDK) for LLM chat + embeddings (`lib/openrouter/*`).
- Migrations: numbered SQL in `supabase/migrations/`, bundled into
  `setup-all.sql` via `npm run db:generate-bundles`.

## Auth & access
- **Sign in / profile**: `features/auth/*` — `requireUserProfile()` is the gate
  used by every server page/action. Roles in `global_role`.
- **Global roles**: `PLATFORM_OWNER`, `SUPERVISOR`, `INTERNAL_SPECIALIST`
  (internal/admin) and `REGISTERED_USER`. The internal-admin check is
  `canViewAdminModulesRole()` in `features/modules/schema.ts` (reused
  platform-wide — not modules-only).
- **Brand membership roles** (client side): `OWNER`, `EXECUTIVE_MANAGER`,
  `BRAND_SPECIALIST`. Deliverable reviewers = `OWNER`/`EXECUTIVE_MANAGER`
  (`features/review-deliverables/reviewer.ts`).
- **Brand access**: `features/access/queries.ts` →
  `getBrandAccessSummaryForProfile()` resolves a profile's active brand + role.

## App shell / navigation
- **Layout**: `app/(app)/layout.tsx` — sidebar + navbar; fetches notifications.
- **Sidebar**: `components/app/Sidebar.tsx` — Home, Integrated Brand Brain
  (Build Roadmap, Brand Brain), Agents, Administration, Documents, Settings.
- **Navbar + notifications bell**: `components/app/AppNavbar.tsx` +
  `components/app/NotificationsBell.tsx`.

## Brand build roadmap (the client journey)
- **Source of truth**: `features/app/build-progress.ts` — 4 phases:
  1. **Brand Research**: Questionnaire → Stakeholder Interviews → Futures Research
  2. **Strategies**: City Model (substep) + Modules
  3. **Aesthetics**: visual direction / color-type / asset library
  4. **Brain Build**: corpus assembly, knowledge sync, agent deployment
- **Roadmap UI**: `app/(app)/integrated-brand-brain/**` (legacy
  `brand-integrated-brain/**` paths are redirect stubs),
  `features/app/components/BrandBuildView.tsx`.

## Questionnaire (client-filled intake) — NOT commentable
- **Where**: `features/questionnaire/*`, routes under
  `.../roadmap/questionnaire/[sectionKey]`.
- **How**: section-by-section form, autosave with retry queue, per-question
  input types (text/long_text/select/etc.). Exports answers to `.docx`
  (`features/questionnaire/docx-generator.ts`). Excluded from commenting because
  the client authors it themselves.

## Review deliverables (uploaded → reviewed → approved)
Shared lifecycle: `PENDING_UPLOAD → CLIENT_REVIEW → CHANGES_REQUESTED → APPROVED`
(`features/review-deliverables/schema.ts`).
- **Shared services**: `features/review-deliverables/`
  - `upload-service.ts` — atomic upload (RPC `attach_review_deliverable`) +
    triggers markdown generation.
  - `mutation-service.ts` — `setReviewReportStatus` (approve / request-changes).
  - `detach-service.ts` — **admin delete**: resets row to `PENDING_UPLOAD`,
    deletes the `files` row, removes storage (`ADMIN_FILE_DELETED`).
  - `reviewer.ts` — resolves the signed-in client reviewer.
- **Surfaces** (each = feature folder + client route + admin route):
  - **Stakeholder Interviews**: `features/stakeholder-interviews/*`;
    client `.../roadmap/stakeholder-interviews`; admin
    `/admin/stakeholder-interviews`.
  - **Futures Research**: `features/futures-research/*` (+ interactive HTML
    "storyline" served via `/api/futures-research/storyline/[reportId]`); admin
    `/admin/futures-research`.
  - **City Model districts**: `features/city-model-deliverables/*`; client
    `.../roadmap/city-model/[districtSlug]`; admin `/admin/city-model`. One
    uploadable file per (brand, district).
- **Admin upload + delete**: each admin page shows an upload form and a
  **Delete (with confirmation pop-up)** action when a file exists
  (`components/admin/DeleteDeliverableButton.tsx` + ConfirmDialog).

## Modules (internal strategy-document workflow) — load-bearing, feeds RAG
- **Where**: `features/modules/*`; client `/modules`, `/modules/[moduleId]`;
  admin `/admin/modules`, `/admin/modules/[moduleId]`.
- **What**: 7 canonical doc types (Brand Knowledge, Archetype, Market
  Intelligence, City Experience, Language Style, Visual System, Researches &
  Benchmarks). 12-state machine: `NOT_STARTED → ASSIGNED → IN_PROGRESS →
  INTERNAL_REVIEW → SUPERVISOR_APPROVED → CLIENT_REVIEW → CLIENT_APPROVED /
  CLIENT_CHANGE_REQUESTED → RAG_REVIEW_REQUIRED → RAG_APPROVED → RAG_SYNCED →
  LOCKED`.
- **Flow**: internal uploads draft → supervisor approves → client reviews →
  RAG approval → synced to vector DB. **This is the main source of RAG
  knowledge files.** Not redundant with City Model.

## Unified commenting + viewer (everything except questionnaire)
- **Viewer**: `components/review/ReviewableDocumentViewer.tsx` — renders markdown
  sections (Google-Docs style), per-section comment rail, threads, reply / edit /
  delete / resolve, Approve / Request-changes, download original.
- **Markdown render**: `components/markdown/MarkdownContent.tsx` (RTL-aware,
  `dir="auto"`); section splitter `lib/markdown/blocks.ts` (heading → stable
  `anchor_id` slug).
- **Comments**: `features/review-comments/*` — table `review_comments`
  (polymorphic `subject_type`/`subject_id`, threaded, block-anchored). Adding a
  comment fans out a notification via RPC `add_review_comment`.
- **Notifications**: `features/notifications/*` — table `notifications`; bell in
  navbar with unread badge + deep links. Internal team shares the
  `INTERNAL_TEAM` inbox.
- **Wired into**: City Model, Stakeholder, Futures, Modules client review.

## Document content pipeline (PDF → markdown → RAG)
- **`features/review-content/`**:
  - `resolve.ts` — `resolveDeliverableMarkdown()` (cache → `.md` → live extract)
    and `generateAndCacheDeliverableMarkdown()` (run after upload, non-fatal).
  - `pdf-to-markdown.ts` — LLM pass (OpenRouter) that restructures extracted text
    into Markdown with headings (preserves Persian/RTL, no translation/invention).
  - `markdown-cache.ts` — caches generated markdown per file (`deliverable_markdown`
    table, `on delete cascade` with the file).
- **Note**: PDF→text drops images. Images aren't needed for RAG (text-only
  embeddings); they only matter for human viewing.

## RAG (retrieval-augmented generation)
- **Where**: `features/rag/*`.
  - `text-extractor.ts` — extract text from docx/pdf/txt/markdown.
  - `pdf-to-markdown` reuse + `chunker.ts` — `chunkMarkdown()` (heading-aware,
    chunks align with comment anchors) / `chunkText()` (fallback).
  - `pgvector-sync.ts` — `syncFileToChunks()`: prefers cached/generated markdown,
    embeds chunks, stores in `knowledge_chunks` (pgvector, RPC
    `replace_knowledge_chunks`).
  - `embeddings.ts` — OpenRouter `text-embedding-3-small`.
  - `vector-search.ts` — `searchBrandKnowledge()` (cosine match, HNSW index).
  - `queries.ts` / `actions.ts` — RAG approval queue (from modules) + promotion.
- **Approval gates**: only supervisor- + owner-approved files become
  `RAG_SYNCED`.

## Agents (brand "brain")
- **Where**: `features/agents/*` — catalog, runs, brain.
  - `runs/llm.ts` — builds answers from RAG context (`searchBrandKnowledge`).
  - `brain/*` — streaming chat (`/api/brain/stream`), image prompts.
- Agent definitions in `features/agents/catalog/`.

## Documents (generic uploaded files)
- **Where**: `features/documents/*`; admin console
  `features/documents/components/AdminDocumentsConsole.tsx`.
- **What**: generic upload (PDF/DOCX/TXT/MD/CSV), visibility + status, signed
  URLs (inline/download), archive + **delete (with ConfirmDialog)**.
- **Storage core**: `features/documents/storage.ts` (bucket ops, signed URLs),
  `storage-cleanup.ts` (deferred deletion queue + retries).

## Admin area
- `app/(admin)/admin/*`: brands/entitlements/plans, documents, modules,
  city-model, stakeholder-interviews, futures-research, RAG approval, questionnaire
  builder, submissions, demo access requests.

## Cross-cutting libs
- `lib/supabase/*` — server/admin clients, env, error helpers (`isMissingTableError`,
  `wrapSupabaseError`).
- `lib/openrouter/*` — client + model registry + cost.
- `lib/routes.ts` — route constants. `lib/errors.ts` — `DomainError`.
- `lib/logging/server.ts` — `logServerError`. `lib/audit/*` — audit logs.
- `lib/security/file-upload.ts` — `validateSecureUpload` (magic-byte checks).

## Database (key tables)
- `users_profile`, `brands`, `brand_memberships`, `brand_entitlements`, `plans`.
- `files` (shared file metadata), `storage_cleanup_jobs`.
- `intake_*` (questionnaire), `brand_modules`, `module_artifacts`, `module_reviews`.
- `stakeholder_interview_reports`, `futures_research_reports`,
  `city_model_district_files`.
- `knowledge_files`, `knowledge_chunks` (pgvector).
- `review_comments`, `notifications`, `deliverable_markdown` (latest features —
  migrations 0041–0048, **must be applied to Supabase**).

## Verify / build
- `npm run typecheck` · `npm run lint` · `npm run test:unit` (vitest) ·
  `npm run build` · `npm run db:check-bundles`.
- Combined: `npm run verify`.

## Pending manual step
- Apply migrations **0041–0048** to Supabase: 0041 commenting, 0042 drop old
  annotations, 0043 markdown cache, 0044 directional-audience notifications,
  0045 commenting CHECK constraints + FK indexes, 0046 inline comment
  highlights, 0047 audit_logs created_at index, 0048 RAG search ef_search
  recall. Code degrades gracefully until then.
