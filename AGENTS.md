<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# JobNomad — project rules

Source of truth: `JobNomad_Conception_Technique_v1.2.pdf` and `JobNomad_Strategie_IA.pdf`.

## Stack (phase 1, locked)
Next.js 16.2 (App Router, Turbopack default) · React 19.2 · Tailwind v4 + shadcn/ui · Supabase (Postgres + Auth + pgvector, Frankfurt) · Vercel Hobby + Vercel Cron · Gemini 2.5 Flash-Lite (extraction) · OpenAI text-embedding-3-small · Stripe · Resend.

**Do NOT introduce**: N8N, Supabase Pro, Claude Sonnet, Vercel Pro, Redis, additional sources beyond RemoteOK. These are phase 2+ (gated at ~100 paying subs).

## Next.js 16 breaking changes (always apply)
- Route handler params are `Promise`: `{ params: Promise<{ id: string }> }`, use `const { id } = await params`.
- `middleware.ts` is deprecated → use `proxy.ts` (nodejs runtime). MVP has none.
- `next/image` remote hosts must be whitelisted in `next.config.ts` via `images.remotePatterns`.
- Config file is `next.config.ts` (TypeScript native), not `.js`/`.mjs`.
- React Compiler: **off** in phase 1. View Transitions / Cache Components / PPR: **off**.

## Architecture rules
- Layered code: `app/` (UI + route handlers) → `/lib` (pure domain: scoring, parsing, source adapters) → infra SDKs. **Business logic stays in `/lib`** so the phase 2 N8N migration just calls the same HTTP endpoints.
- Cron handlers live in `app/api/cron/*/route.ts`, declared in `vercel.json`. Each must:
  - Check `Authorization: Bearer ${process.env.CRON_SECRET}` and return 401 otherwise.
  - Set `export const maxDuration = 60` (Hobby limit). Use batches + early exit on a `deadlineMs: 50_000` budget.
- All AI attributes are **pre-computed at ingestion** and stored on `jobs`. User feed = pure SQL (target < 200ms). Never call an LLM on user click.
- Service role Supabase key: server-only (cron handlers). Never ship to client.

## Data & security
- Every user-owned table has RLS enabled with `user_id = auth.uid()` policies. `jobs` is readable when `status = 'active'`. Add an RLS test for any new policy.
- Auth = Supabase magic links only. No passwords.
- Validate every external input (forms, webhooks, AI outputs) with Zod. Stripe webhooks must verify the signature.
- No PII in LLM prompts beyond what the user typed in their own profile. Never log prompts/responses > 7 days.
- Retention is aggressive to stay on Supabase Free: jobs 14d active / 30d expired, job_views 60d, digests 30d. Don't relax without checking DB usage.

## AI pipeline conventions
- Extraction: Gemini 2.5 Flash-Lite with `response_schema` (structured outputs). Validate again with Zod server-side. Failure budget < 2%; on parse failure, retry once sync, then mark `extraction_failed`.
- Dedup before any LLM call: `sha256(normalize(title) + normalize(company) + normalize(description[:200]))` → unique on `jobs.hash_dedup`.
- Embeddings: OpenAI `text-embedding-3-small` (1536 dims), stored in `pgvector`.
- Phase 1 = synchronous Gemini (not Batch API — that's phase 2).
- Every AI call writes a row to `ai_usage_log` (model, tokens_in/out, cost_usd).

## Scope discipline
- MVP scope = MUST-have features only (F-M01..F-M12 in the spec). Don't implement SHOULD/COULD/WON'T without explicit user approval.
- Cost ceiling phase 1: ~$5/month infra. Any new paid service requires explicit approval.
