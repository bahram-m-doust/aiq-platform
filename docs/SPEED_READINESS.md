# Bextudio Speed Readiness

This pass keeps MVP behavior intact while reducing avoidable runtime work.

## Decisions

- RAG sync, OpenAI File Search, vector stores, and Agent async architecture are out of scope for this pass.
- List reads use bounded pagination with a default page size of 25 and a maximum page size of 100.
- Only shared, low-change configuration data may be cached: active plans, active agent catalog rows, and intake question configuration.
- User-specific data, membership, entitlements, signed URLs, files, audit logs, module state, agent outputs, and RAG state stay uncached.

## Runtime Bottlenecks Addressed

- Added composite indexes for high-traffic brand-scoped list and history queries.
- Bounded admin/client list reads for modules, files, change requests, and audit logs.
- Cached non-sensitive configuration data with tags or short TTLs.
- Kept existing server-side authorization and service-role boundaries unchanged.

## Future Scale Backlog

- Move RAG sync and long Agent runs to a queue/status model.
- Add rate limits and quota controls around OpenAI-backed actions.
- Add slow-query and external API latency telemetry.
- Add staging `EXPLAIN` checks for the largest production-like datasets.
- Consider cursor pagination once datasets exceed simple page-based admin workflows.
