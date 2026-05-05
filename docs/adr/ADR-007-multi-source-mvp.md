# ADR-007 — Multi-source ingestion in phase 1 MVP

**Status**: Accepted  
**Date**: May 2026  
**Deciders**: Jérôme (solo founder)

---

## Context

The technical spec v1.2 (§2.3, F-M03) defines tâche #3 as:
> "Pipeline ingestion source unique — RemoteOK toutes les 6h via Vercel Cron"

The additional sources (WWR, Himalayas, Working Nomads) are explicitly classified as **F-S01 SHOULD HAVE / phase 2** (§2.4).

During pre-development analysis, the decision was made to include 3 sources in the MVP:
RemoteOK + WeWorkRemotely + Himalayas. This ADR documents that decision.

---

## Decision

**Expand F-M03 to include 3 sources** (RemoteOK, WWR, Himalayas) in phase 1, shipped as a single cron handler with the adapter pattern already built for easy phase 2 expansion.

---

## Rationale

| Factor | Analysis |
|---|---|
| Volume | 1 source (~50 jobs/day) is below the threshold to meaningfully validate the AI extraction quality. 3 sources (~250 jobs/day after dedup) gives statistical confidence within 1 week. |
| User value | A feed with 3 sources is immediately more useful to beta users than a single-source feed. Better retention for PMF validation. |
| Implementation cost | The adapter pattern encapsulates per-source differences. Adding WWR and Himalayas on top of the RemoteOK adapter took ~6 hours, not ~3 days. The risk of scope creep was low. |
| ToS compliance | RSS feeds are the official data access method for WWR and Himalayas (no scraping). This satisfies §3.5 of the spec ("seulement APIs publiques ou RSS officiel au MVP"). |
| Gemini cost | 3x volume = ~$3-9/month instead of ~$1-3. Still within the $5 phase 1 ceiling with room to spare. Monitoring via ai_usage_log. |

---

## Alternatives considered

### A — RemoteOK only (F-M03 strict)
**Rejected**: Satisfies the spec but limits product quality for PMF validation. The additional implementation effort was minimal given the adapter pattern.

### B — RemoteOK + WWR only (2 sources)
**Rejected**: Himalayas RSS is a higher-quality feed with more APAC-friendly jobs. Adding it costs minimal extra effort.

### C — All 4 sources (including Working Nomads)
**Rejected for now**: Working Nomads has a less reliable RSS feed and lower job volume. Deferred to phase 2 when N8N handles multi-source orchestration more robustly. The DB schema already includes `workingnomads` in the `source` CHECK constraint.

---

## Consequences

### Positive
- Better product quality from day 1.
- Adapter pattern ready for N8N migration (N8N calls the same HTTP endpoint).
- Cross-source deduplication prevents duplicate AI calls (SHA-256 hash, spec §ADR-003).

### Negative / risks
- 3x Gemini extraction cost (mitigated: still within $5/month ceiling).
- 3x surface area for ToS changes (mitigated: RSS is the most stable data access method).
- Working Nomads remains at phase 2 — might cause user confusion if they notice the omission.

### Rollback plan
Any source can be disabled without a code deploy:
```bash
# In Vercel Dashboard → Environment Variables:
INGEST_DISABLED_SOURCES=wwr,himalayas
```
The next cron run will skip disabled sources automatically.

---

## Implementation

| Layer | Files |
|---|---|
| Types | `src/lib/sources/types.ts`, `src/lib/sources/schemas.ts` |
| Utilities | `src/lib/sources/normalize.ts`, `src/lib/sources/http.ts`, `src/lib/sources/rss.ts` |
| Adapters | `src/lib/sources/adapters/{remoteok,wwr,himalayas}.ts` |
| Orchestrator | `src/lib/sources/ingest.ts` |
| Route handler | `app/api/cron/ingest/route.ts` |
| DB | `supabase/migrations/20260505000018_source_state.sql` |
