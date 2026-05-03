# JobNomad — Database Schema Reference

> **Phase 1 MVP** · Supabase (Postgres 15 + pgvector) · Frankfurt region  
> Source of truth: `JobNomad_Conception_Technique_v1.2.pdf` §5 + `JobNomad_Strategie_IA.pdf` §4, §6

---

## Quick commands

```bash
# Link CLI to your project (one-time)
supabase link --project-ref <your-project-ref>

# Apply all migrations to remote
supabase db push

# Regenerate TypeScript types after any migration
supabase gen types typescript --linked > src/lib/supabase/database.types.ts

# Run local stack (requires Docker)
supabase start
supabase db seed --seed-file supabase/seed.sql

# Run RLS tests (local or remote)
psql $DATABASE_URL -f supabase/tests/rls_user_profiles.sql
psql $DATABASE_URL -f supabase/tests/rls_saved_jobs.sql
psql $DATABASE_URL -f supabase/tests/rls_subscriptions.sql
psql $DATABASE_URL -f supabase/tests/rls_jobs.sql
psql $DATABASE_URL -f supabase/tests/functions_smoke.sql
```

---

## ERD (ASCII)

```
auth.users (Supabase managed)
  │ 1:1 (CASCADE)
  ├──▶ user_profiles (onboarding data, embedding)
  │      │ trigger: on onboarding_completed_at set
  │      ▼
  │    subscriptions (free/pro, Stripe IDs)
  │
  │ 1:N
  ├──▶ saved_jobs ──────────────────┐
  │                                  │ N:1
  ├──▶ job_views                     │
  │                                  │
  ├──▶ email_digests                 │
  │                                  ▼
  ├──▶ feedback_extraction ──▶ jobs (AI-extracted, pgvector)
  │                                  ▲
  └──▶ ai_usage_log                  │ (written by)
                                     │
cron_runs (no user FK) ◀──── /api/cron/ingest, /digest, /cleanup
```

---

## Table descriptions

### `user_profiles`
Created during onboarding (4 steps: timezone → skills → contract → rate).
- `timezone`: IANA string (e.g. `Asia/Bangkok`)
- `skills`: JSONB array of `{name, level}` objects
- `embedding`: 1536-dim vector from OpenAI `text-embedding-3-small` (skills + bio)
- `onboarding_completed_at`: NULL until step 4 done; triggers auto-create of `subscriptions` row

### `subscriptions`
Single source of truth for billing tier.
- Created automatically when `onboarding_completed_at` is set (free tier)
- Mutated only by Stripe webhook handler via `service_role`
- `tier`: `'free'` | `'pro'`
- `status`: mirrors Stripe subscription status

### `jobs`
Central table. Written by cron pipeline, read by everyone.
- All AI attributes are **pre-computed at ingestion** — never re-computed at click time (ADR-003)
- `status` lifecycle: `pending_extraction` → `active` → `expired` (→ deleted after 30d)
- `hash_dedup`: SHA-256 of `normalize(title) + normalize(company) + normalize(description[:200])` — prevents duplicate AI calls across sources
- `embedding`: 1536-dim vector for semantic matching
- `red_flags`: JSONB array of literal text phrases problematic for Asia-based freelancers
- `confidence_scores`: AI self-assessment `{geo_policy, timezone, contract_type}` — scores < 0.6 shown as "ambiguous" in UI

### `saved_jobs`
User bookmarks with lifecycle tracking (`saved` → `applied` → `interviewing` → `offered`).

### `job_views`
Immutable interaction log. Dual purpose:
1. Free-tier quota: 25 `view` actions/day for free users
2. Analytics for future ranking improvement

### `email_digests`
Record of every digest email sent. Anti-duplicate guard (don't send twice/day per user).

### `ai_usage_log`
Immutable cost audit trail. Every Gemini/OpenAI call writes a row here. Used for cost monitoring.

### `cron_runs`
Health tracking for Vercel Cron jobs. UptimeRobot queries this to check last successful run.

### `feedback_extraction`
User-reported extraction errors ("Report an AI error" button on job cards). Feeds weekly sampling process for prompt improvement.

---

## SQL Functions

### `match_jobs_for_user(user_id, limit, offset, ...filters)`
Main feed query. Returns jobs ranked by composite fit score:
- **Hard filter**: incompatible contract type or tz overlap > 8h → score capped at 30
- **Semantic score** (0-100): cosine similarity between job embedding and user profile embedding
- **Salary bonus** (0-20): if job salary_min ≥ user's min_rate_usd

Returns columns ready for the job card component (no JOIN needed in app code).

### `free_tier_remaining(user_id) → INTEGER`
Returns number of job views remaining today. 25/day for free, 999999 for pro.

### `cleanup_expired_data() → JSONB`
Called by `/api/cron/cleanup` weekly. Implements phase 1 retention policy. Returns stats JSON.

### `upsert_subscription(...)` 
Called by Stripe webhook handler. Idempotent upsert.

### `ensure_subscription_row(user_id)`
Creates a free subscription row if none exists. Called automatically by trigger on profile onboarding completion.

---

## Retention policy (phase 1)

| Data | Retention | Implementation |
|---|---|---|
| `jobs` status='active' | 14 days → expire | `cleanup_expired_data()` |
| `jobs` status='expired' | 30 days → delete | `cleanup_expired_data()` |
| `job_views` | 60 days | `cleanup_expired_data()` |
| `email_digests` | 30 days | `cleanup_expired_data()` |
| `ai_usage_log` | 180 days | `cleanup_expired_data()` |
| `feedback_extraction` | 180 days | `cleanup_expired_data()` |
| `cron_runs` | 90 days | `cleanup_expired_data()` |
| User deleted | auth cascade immediate | `ON DELETE CASCADE` on all FKs |

---

## RLS summary

| Table | Anon | Auth (own) | Auth (other) | service_role |
|---|---|---|---|---|
| `user_profiles` | ❌ | ✅ CRUD | ❌ | ✅ bypass |
| `subscriptions` | ❌ | ✅ SELECT | ❌ | ✅ bypass |
| `jobs` | ✅ SELECT (active only) | ✅ SELECT (active only) | same | ✅ bypass |
| `saved_jobs` | ❌ | ✅ CRUD | ❌ | ✅ bypass |
| `job_views` | ❌ | ✅ SELECT + INSERT | ❌ | ✅ bypass |
| `email_digests` | ❌ | ✅ SELECT | ❌ | ✅ bypass |
| `ai_usage_log` | ❌ | ✅ SELECT (own) | ❌ | ✅ bypass |
| `cron_runs` | ❌ | ❌ | ❌ | ✅ bypass |
| `feedback_extraction` | ❌ | ✅ SELECT + INSERT + UPDATE | ❌ | ✅ bypass |

---

## Indexes

| Index | Table | Purpose |
|---|---|---|
| `idx_jobs_status_posted_at` | jobs | Main feed query (partial: status='active') |
| `idx_jobs_pending_extraction` | jobs | Cron pipeline pickup |
| `idx_jobs_geo_policy` | jobs | Filter (FM07) |
| `idx_jobs_contract_type` | jobs | Filter |
| `idx_jobs_seniority` | jobs | Filter |
| `idx_jobs_salary_min` | jobs | Filter (salary range) |
| `idx_jobs_embedding` | jobs | Vector similarity (ivfflat, lists=100) |
| `idx_jobs_fulltext` | jobs | Full-text search (GIN tsvector) |
| `idx_jobs_skills_required` | jobs | Skills filter (GIN array) |
| `idx_user_profiles_embedding` | user_profiles | Profile similarity (ivfflat, lists=50) |
| `idx_saved_jobs_user_saved_at` | saved_jobs | User's bookmark list |
| `idx_job_views_user_date` | job_views | Free-tier quota check |
| `idx_email_digests_user_sent_at` | email_digests | Anti-duplicate check |
| `idx_ai_usage_log_model_date` | ai_usage_log | Cost monitoring |
| `idx_cron_runs_name_started` | cron_runs | Health check |

---

## Design decisions

**ADR-003 — Pre-computation**: All AI attributes (geo_policy, tz_requirement, red_flags, embeddings) are computed at ingestion time by the cron pipeline. The user feed is pure SQL with zero LLM calls at click time. This gives < 200ms latency and zero marginal AI cost per user session.

**Hash dedup**: `sha256(normalize(title) + normalize(company) + normalize(description[:200]))` prevents duplicate AI extraction when the same job appears on multiple sources. Saves ~30-50% on Gemini API calls.

**service_role boundary**: The `SUPABASE_SERVICE_ROLE_KEY` is used exclusively in cron handlers (`/api/cron/*`) and Stripe webhook handler (`/api/webhooks/stripe`). It is never shipped to the browser. See `AGENTS.md`.

**pgvector ivfflat lists**: jobs=100, profiles=50. These values are appropriate for datasets up to ~100k rows (phase 1 cap with 14-day retention). Revisit at phase 2 if approaching 1M rows.

**RGPD cascade**: All user-owned tables use `ON DELETE CASCADE` on `auth.users(id)`. Deleting a user in Supabase Auth instantly cascades to all their data. `ai_usage_log` uses `ON DELETE SET NULL` to preserve cost audit records (anonymized) as required for financial compliance.
