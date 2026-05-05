# Auth Setup Runbook

Magic link authentication using Supabase Auth + Resend SMTP.

**Stack**: Supabase Auth (PKCE) -> Resend SMTP -> `auth@jobnomad.app`
**Dev local**: Supabase CLI + Inbucket (no real emails, no Resend quota)
**Production**: Resend cloud SMTP, domain `jobnomad.app` verified with DKIM/SPF/DMARC

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local Development (Inbucket)](#2-local-development-inbucket)
3. [Setup Resend Account (Production)](#3-setup-resend-account-production)
4. [DNS Records for jobnomad.app](#4-dns-records-for-jobnomadapp)
5. [Setup Supabase SMTP (Production)](#5-setup-supabase-smtp-production)
6. [Setup Vercel Environment Variables](#6-setup-vercel-environment-variables)
7. [Supabase Dashboard Configuration](#7-supabase-dashboard-configuration)
8. [Auth Flow](#8-auth-flow)
9. [Security Measures](#9-security-measures)
10. [Email Templates](#10-email-templates)
11. [Testing](#11-testing)
12. [Sanity Checklist (Before Going Live)](#12-sanity-checklist-before-going-live)
13. [Diagnostics & Troubleshooting](#13-diagnostics--troubleshooting)
14. [Key Rotation](#14-key-rotation)

---

## 1. Prerequisites

- Node.js 20+, npm 10+
- Supabase project (Frankfurt / eu-central-1)
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A domain you control (`jobnomad.app`) with DNS access
- A [Resend](https://resend.com) account (free tier: 100 emails/day, 3000/month)

---

## 2. Local Development (Inbucket)

In development, **no Resend API key is needed**. All auth emails are captured by
[Inbucket](http://localhost:54324), a local email server bundled with the Supabase CLI.

### Setup

```bash
# 1. Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase  # macOS
# or: npm install -g supabase@latest

# 2. Link to your cloud project (one-time)
npx supabase link --project-ref <your-project-ref>

# 3. Start local Supabase stack
npx supabase start
# This starts: Postgres 17, Auth, API, Studio, Inbucket

# 4. Start Next.js dev server (separate terminal)
npm run dev
```

### Testing magic links locally

```
1. Open http://localhost:3000/auth/login
2. Enter any email (e.g. test@example.com)
3. Click "Send magic link"
4. Open http://localhost:54324 (Inbucket)
5. Find the email -- click the magic link
6. Redirected to /feed with active session
```

### Local Inbucket ports

| Service | Port | URL |
|---------|------|-----|
| Inbucket web UI | 54324 | http://localhost:54324 |
| SMTP (for local testing tools) | 54325 | - |
| POP3 | 54326 | - |

### .env.local for local development

Minimal required vars (copy from `.env.example`):

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<from: supabase start output>
SUPABASE_SERVICE_ROLE_KEY=<from: supabase start output>
RATE_LIMIT_PEPPER=any-16-char-string-here
# RESEND_API_KEY not needed for local dev
```

---

## 3. Setup Resend Account (Production)

### 3.1 Create account

1. Go to https://resend.com and create a free account
2. The free tier gives 100 emails/day and 3,000/month -- sufficient for MVP

### 3.2 Add and verify domain

1. In Resend dashboard: **Domains** -> "Add Domain"
2. Enter `jobnomad.app`
3. Resend will show you DNS records to add (SPF, DKIM x2, optional DMARC)
4. Add the records at your DNS provider (see Section 4 for exact records)
5. Click "Verify" in Resend -- wait up to 30 minutes for DNS propagation
6. Status must show **Verified** (green) before sending any emails

### 3.3 Create a restricted API key

**Do NOT use a global API key.** Create a domain-scoped key:

1. Resend dashboard: **API Keys** -> "Create API Key"
2. **Name**: `jobnomad-supabase-smtp`
3. **Permission**: `Sending Access` (not Full Access)
4. **Domain**: `jobnomad.app` (restrict to your verified domain)
5. Click "Add" and copy the key immediately -- it's only shown once
6. This key starts with `re_` -- store it as `RESEND_API_KEY`

**Why domain-scoped?** If the key leaks, attackers can only send from `jobnomad.app`,
not impersonate other domains in your Resend account.

---

## 4. DNS Records for jobnomad.app

Add these records at your DNS provider (Cloudflare, OVH, Namecheap, etc.).
Resend will provide the exact values in their dashboard -- use those, as they
are specific to your Resend account.

### Records to add

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | `@` or `jobnomad.app` | `v=spf1 include:amazonses.com ~all` | 3600 |
| CNAME | `resend._domainkey` | `resend._domainkey.resend.com` | 3600 |
| CNAME | `resend2._domainkey` | `resend2._domainkey.resend.com` | 3600 |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@jobnomad.app` | 3600 |

> **Note**: The exact SPF and DKIM values come from Resend dashboard -- use those.
> The DMARC record above is recommended for production. Start with `p=none` to
> monitor, then switch to `p=quarantine` after verifying no legitimate email is failing.

### Verify DNS propagation

```bash
# Check SPF
dig TXT jobnomad.app

# Check DKIM
dig CNAME resend._domainkey.jobnomad.app

# Check DMARC
dig TXT _dmarc.jobnomad.app
```

Or use https://mxtoolbox.com/SuperTool.aspx for a web UI.

---

## 5. Setup Supabase SMTP (Production)

### 5.1 Required environment variables

Add these to your `.env.local` (and Vercel -- see Section 6):

```env
# Supabase project ref (20 lowercase letters -- from Settings > General)
SUPABASE_PROJECT_REF=abcdefghijklmnopqrst

# Personal access token (sbp_...) -- ONLY for the setup script, not app runtime
# Generate at: https://supabase.com/dashboard/account/tokens
SUPABASE_ACCESS_TOKEN=sbp_...

# Resend API key
RESEND_API_KEY=re_...

# Email sender identity
EMAIL_FROM_ADDRESS=auth@jobnomad.app
EMAIL_FROM_NAME=JobNomad
```

### 5.2 Apply SMTP config via script (recommended)

The project includes an idempotent script that configures Supabase Auth SMTP
via the Supabase Management API:

```bash
# Preview the payload (no API calls)
npm run smtp:dry

# Apply the SMTP config + push email templates
npm run smtp:setup

# Verify the config is live
npm run smtp:verify
```

The script configures:
- `smtp_host`: `smtp.resend.com`
- `smtp_port`: `465` (TLS)
- `smtp_user`: `resend`
- `smtp_pass`: your `RESEND_API_KEY`
- `smtp_admin_email`: `auth@jobnomad.app`
- `smtp_sender_name`: `JobNomad`
- `smtp_max_frequency`: 60 (anti-spam: 1 email/minute/recipient max)
- `mailer_otp_exp`: 3600 (magic links expire in 1 hour)
- `mailer_secure_email_change_enabled`: true

### 5.3 Manual setup (alternative)

If the script is unavailable, configure manually in the Supabase Dashboard:
**Authentication -> Settings -> SMTP**

| Field | Value |
|-------|-------|
| SMTP host | `smtp.resend.com` |
| SMTP port | `465` |
| Username | `resend` |
| Password | Your `RESEND_API_KEY` (`re_...`) |
| Sender email | `auth@jobnomad.app` |
| Sender name | `JobNomad` |

---

## 6. Setup Vercel Environment Variables

Go to your Vercel project: **Settings -> Environment Variables**

| Variable | Production | Preview | Development | Sensitive |
|----------|-----------|---------|-------------|-----------|
| `NEXT_PUBLIC_SITE_URL` | `https://jobnomad.app` | `https://jobnomad-*.vercel.app` | `http://localhost:3000` | No |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Same | `http://localhost:54321` | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | Same | Local key | No |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Same | Local key | **Yes** |
| `SUPABASE_PROJECT_REF` | `abcdefghijklmnopqrst` | Same | Same | No |
| `RESEND_API_KEY` | `re_...` | `re_...` | (leave empty) | **Yes** |
| `EMAIL_FROM_ADDRESS` | `auth@jobnomad.app` | `auth@jobnomad.app` | (leave empty) | No |
| `EMAIL_FROM_NAME` | `JobNomad` | `JobNomad (Preview)` | (leave empty) | No |
| `CRON_SECRET` | `<random 32+ chars>` | Same | (local only) | **Yes** |
| `RATE_LIMIT_PEPPER` | `<random 16+ chars>` | Same | (local only) | **Yes** |
| `GEMINI_API_KEY` | `AIza...` | Same | (optional) | **Yes** |
| `OPENAI_API_KEY` | `sk-proj-...` | Same | (optional) | **Yes** |
| `STRIPE_SECRET_KEY` | `sk_live_...` | `sk_test_...` | (optional) | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | `whsec_...` | (optional) | **Yes** |

> **SUPABASE_ACCESS_TOKEN**: Do NOT add to Vercel runtime vars. It is only needed
> locally (`.env.local`) and as a GitHub Secret for CI. It is a management token,
> not an application runtime credential.

### Generating secrets

```bash
# CRON_SECRET
openssl rand -hex 32

# RATE_LIMIT_PEPPER
openssl rand -hex 16
```

---

## 7. Supabase Dashboard Configuration

### Authentication -> URL Configuration

1. **Site URL**: `https://jobnomad.app`
2. **Redirect URLs** (click "Add URL" for each):
   - `https://jobnomad.app/auth/callback`
   - `https://jobnomad-*.vercel.app/auth/callback` (preview deployments)
   - `http://localhost:3000/auth/callback` (local dev)

### Authentication -> Providers -> Email

| Setting | Value |
|---------|-------|
| Enable Email provider | On |
| Confirm email | Off (magic links are implicit confirmation) |
| Secure email change | On |
| Double confirm changes | On |

### Authentication -> Email Templates

After running `npm run smtp:setup`, the templates in `supabase/templates/` are
pushed to Supabase automatically. You can also set them manually:

1. **Authentication -> Email Templates -> Magic Link**
   - Copy the content of `supabase/templates/magic-link.html`
2. **Authentication -> Email Templates -> Confirm signup**
   - Copy the content of `supabase/templates/confirm-signup.html`
3. **Authentication -> Email Templates -> Reset password**
   - Copy the content of `supabase/templates/recovery.html`

---

## 8. Auth Flow

```
[User] visits /auth/login
    |
    v
[LoginForm] enters email -> Server Action: sendMagicLink()
    |
    +-- Zod validation (trim, lowercase, format check)
    +-- Rate limit check (5 attempts/IP/hour via auth_rate_limits RPC)
    +-- supabase.auth.signInWithOtp({ email, emailRedirectTo: '/auth/callback' })
    |       |
    |       v
    |   [Supabase Auth Cloud]
    |       +-- Generates OTP/code
    |       +-- Calls SMTP (smtp.resend.com:465 with RESEND_API_KEY)
    |       v
    |   [Resend SMTP]
    |       +-- DKIM signs email with jobnomad.app key
    |       +-- Delivers to user inbox
    |
    v
[UI] always shows "Check your email" (prevents email enumeration)
    |
    v
[User] clicks magic link in email
    |
    v
[Supabase] redirects to /auth/callback?code=<pkce-code>
    |
    v
[/auth/callback] GET handler (PKCE code exchange)
    |
    +-- safeReturnTo(next) -- validates next= param (open-redirect protection)
    +-- supabase.auth.exchangeCodeForSession(code)
    +-- On success: redirect to /feed (or validated next path)
    +-- On error: redirect to /auth/error?reason=link_expired|exchange_failed
    |
    v
[/feed] protected route
    +-- proxy.ts refreshes JWT on every request
    +-- Server Components call getUser() -- validates session server-side
```

---

## 9. Security Measures

| Layer | Protection |
|-------|-----------|
| Input validation | Zod schema on all form data (`loginFormSchema`) |
| Email enumeration | Always returns "check your email" (even on Supabase errors) |
| Rate limiting | 5 attempts per IP per hour (hashed IP, GDPR compliant) |
| Open redirect | `safeReturnTo()` blocks protocol-relative, schemes, encoded bypasses |
| PKCE | Supabase PKCE flow (code exchange, not implicit grant) |
| Session | Server-side JWT validation via `getUser()` (not `getSession()`) |
| Signout | POST-only route handler (prevents CSRF via GET prefetch) |
| Headers | X-Frame-Options, HSTS, CSP, Referrer-Policy, CORP, COOP |
| Proxy | `proxy.ts` refreshes JWT on every matched request |
| SMTP API key | Domain-scoped Resend key (`jobnomad.app` only) |
| SMTP password | Never logged (redacted in scripts, not in app code) |
| Templates | No external CDN resources, no tracking pixels |
| Secret isolation | `RESEND_API_KEY` and `SUPABASE_ACCESS_TOKEN` gated by `env-leak.test.ts` |

---

## 10. Email Templates

Templates live in `supabase/templates/`. They follow email client best practices:

| File | Purpose |
|------|---------|
| `magic-link.html` | Magic link sign-in (HTML) |
| `magic-link.txt` | Magic link sign-in (plain text fallback) |
| `confirm-signup.html` | Email confirmation for new accounts (HTML) |
| `confirm-signup.txt` | Email confirmation (plain text) |
| `recovery.html` | Password reset (HTML, phase 2) |
| `recovery.txt` | Password reset (plain text) |

### Template constraints

- All templates use `{{ .ConfirmationURL }}` (Supabase required variable)
- No external image/CDN resources (anti-tracking, anti-spam score)
- Table-based layout for Outlook compatibility
- Mobile-responsive via media queries
- Plain text variants for all HTML templates (a11y + spam score)

### Modifying templates

```bash
# Edit the template
vim supabase/templates/magic-link.html

# Push updated templates to Supabase
npm run smtp:setup

# Run template tests to verify integrity
npx vitest run supabase/templates/__tests__/templates.test.ts
```

---

## 11. Testing

### Unit tests

```bash
# Run all unit + static tests
npm run test

# Specific test files
npx vitest run src/lib/__tests__/env.test.ts          # Env var validation
npx vitest run src/lib/__tests__/env-leak.test.ts     # Secret containment
npx vitest run scripts/__tests__/setup-supabase-smtp.test.ts  # SMTP script
npx vitest run supabase/templates/__tests__/templates.test.ts # Template integrity
npx vitest run src/lib/auth/__tests__/schemas.test.ts         # Auth schemas
npx vitest run src/lib/auth/__tests__/rate-limit.test.ts      # Rate limiting
npx vitest run src/lib/auth/__tests__/actions.integration.test.ts # Server action
```

### E2E tests (UI)

```bash
# Install Playwright browsers (first time only)
npx playwright install chromium

# Run standard E2E suite (UI tests, no real email)
npm run test:e2e

# Run specific E2E files
npx playwright test e2e/auth.spec.ts
```

### SMTP health smoke test (production/staging only)

```bash
# Set required env vars first (or they must be in .env.local)
export SMTP_HEALTH_TEST=1
export SMTP_HEALTH_EMAIL=your-real-email@gmail.com
export NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...
export RESEND_API_KEY=re_...
export EMAIL_FROM_ADDRESS=auth@jobnomad.app

# Run the smoke test
npx playwright test e2e/auth-smtp-health.spec.ts --project=chromium
```

Or trigger it manually in GitHub Actions:
**Actions -> "SMTP Health Check" -> "Run workflow"**

### pgTAP tests (database / RLS)

```bash
# Requires local Supabase running
npx supabase test db
```

### Manual testing checklist

- [ ] Visit `/auth/login` -- form renders correctly
- [ ] Submit invalid email -- validation error shown
- [ ] Submit valid email -- "Check your email" shown
- [ ] Open Inbucket (http://localhost:54324) or real inbox
- [ ] Click magic link -- redirected to `/feed` with active session
- [ ] Visit `/feed` without auth -- redirected to `/auth/login`
- [ ] Sign out -- redirected to `/auth/login`
- [ ] Visit `/auth/error?reason=link_expired` -- correct error page

---

## 12. Sanity Checklist (Before Going Live)

Run through this checklist before launching to production:

**Resend**
- [ ] Account created and verified email address
- [ ] Domain `jobnomad.app` added and status is **Verified**
- [ ] DNS records (SPF, DKIM x2) are propagated (`dig CNAME resend._domainkey.jobnomad.app`)
- [ ] DMARC record added (`dig TXT _dmarc.jobnomad.app`)
- [ ] API key created with scope **Sending Access** + domain **jobnomad.app**
- [ ] API key starts with `re_` and is stored in Vercel as sensitive env var

**Supabase**
- [ ] `npm run smtp:verify` returns correct config (no config drift)
- [ ] Site URL set to `https://jobnomad.app` in Supabase Dashboard
- [ ] Redirect URL `https://jobnomad.app/auth/callback` is in the allowlist
- [ ] Preview URL wildcard `https://jobnomad-*.vercel.app/auth/callback` is in allowlist
- [ ] Email templates are set (magic-link, confirm-signup)

**Vercel**
- [ ] All env vars in the table in Section 6 are set
- [ ] Sensitive vars (`RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.) are marked sensitive
- [ ] `NEXT_PUBLIC_SITE_URL=https://jobnomad.app` (not localhost)

**End-to-end**
- [ ] Magic link received in < 30 seconds after submitting form
- [ ] DKIM shows `PASS` in email headers (Gmail: view original -> Authentication-Results)
- [ ] SPF shows `PASS`
- [ ] Magic link click -> redirected to `/feed` with session
- [ ] Resend Dashboard -> Emails: email shows `delivered` status

**Security**
- [ ] `npm run test` passes (all unit + static tests)
- [ ] `SUPABASE_ACCESS_TOKEN` is NOT in Vercel runtime vars (only local + GitHub Secrets)
- [ ] No secrets in `git log -p` (gitleaks vert in CI)

---

## 13. Diagnostics & Troubleshooting

### Magic link not received

1. **Check spam folder** first
2. **Supabase logs**: Dashboard -> Logs -> Auth Logs -- look for `OTP` events
3. **Resend logs**: Dashboard -> Emails -- look for the email + event status
4. **DNS check**:
   ```bash
   dig TXT jobnomad.app          # Should show SPF include:amazonses.com
   dig CNAME resend._domainkey.jobnomad.app  # Should resolve
   ```
5. **Config drift**: Run `npm run smtp:verify` -- check for warnings
6. **RESEND_API_KEY format**: Must start with `re_`, not empty
7. **Redirect URL**: `https://jobnomad.app/auth/callback` must be in Supabase allowlist

### "Link expired" error

Magic links expire after **1 hour**. Request a new one.
If links expire immediately: check `mailer_otp_exp` via `npm run smtp:verify` -- should be `3600`.

### "Invalid link / missing_code" error

Usually means the URL was modified (email client rewrote the link).
- Check Supabase Dashboard -> Auth -> URL Configuration for correct callback URL.

### Rate limited in dev

The `auth_rate_limits` table resets after 60 minutes. To clear manually:

```sql
-- Run in Supabase SQL Editor or supabase db shell
DELETE FROM auth_rate_limits;
```

### SMTP config not applied after running setup script

```bash
# Check if config was applied
npm run smtp:verify

# If drift detected, re-apply
npm run smtp:setup

# Check your .env.local has the right values
cat .env.local | grep -E 'SUPABASE_PROJECT_REF|SUPABASE_ACCESS_TOKEN|RESEND'
```

### Resend delivery failures

In Resend Dashboard -> Emails, common event statuses:
- `sent`: Resend accepted the email, delivery in progress
- `delivered`: Email delivered to recipient inbox
- `bounced`: Invalid email address -- check address format
- `complained`: Spam complaint -- check email content and sender reputation
- `failed`: SMTP auth error -- check `RESEND_API_KEY` is valid and domain is verified

---

## 14. Key Rotation

### Rotating RESEND_API_KEY

```bash
# 1. Create a new API key in Resend dashboard (do NOT delete the old one yet)
#    Name: jobnomad-supabase-smtp-<date>
#    Same settings: Sending Access, domain jobnomad.app

# 2. Update .env.local with the new key
RESEND_API_KEY=re_new_key_here

# 3. Apply the new key to Supabase
npm run smtp:setup

# 4. Verify the new key is live
npm run smtp:verify

# 5. Update the key in Vercel: Settings -> Environment Variables -> RESEND_API_KEY
#    Trigger a redeployment (Vercel -> Deployments -> Redeploy)

# 6. Run the SMTP smoke test to confirm end-to-end
SMTP_HEALTH_TEST=1 npx playwright test e2e/auth-smtp-health.spec.ts

# 7. Only after confirming: revoke the old key in Resend dashboard
```

### Rotating SUPABASE_ACCESS_TOKEN

This token is only used by the setup script, not by the running application.

```bash
# 1. Generate a new token at https://supabase.com/dashboard/account/tokens
# 2. Update .env.local
SUPABASE_ACCESS_TOKEN=sbp_new_token

# 3. Update in GitHub Secrets (for CI smtp:verify job)
# 4. Revoke the old token in Supabase dashboard
```

### Rotating CRON_SECRET

```bash
# 1. Generate new secret
openssl rand -hex 32

# 2. Update in Vercel env vars (Settings -> Environment Variables)
# 3. Update in GitHub Secrets
# 4. Redeploy (Vercel auto-redeploys on env var changes)
# 5. Verify cron runs in Vercel dashboard logs
```
