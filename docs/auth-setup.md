# Auth Setup Runbook

Magic link authentication using Supabase Auth + Resend SMTP.

## Prerequisites

- Supabase project (Frankfurt region, free tier)
- Resend account (free tier: 100 emails/day)
- Verified domain in Resend (for production)

## 1. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
# Supabase (from project Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Site URL (must match Supabase redirect allowlist)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Security
CRON_SECRET=<random 32+ char string>
RATE_LIMIT_PEPPER=<random 32+ char string>

# Resend (optional for local dev - Supabase sends via built-in SMTP)
RESEND_API_KEY=re_...
```

## 2. Supabase Dashboard Configuration

### Auth Settings (Authentication > URL Configuration)

1. **Site URL**: `http://localhost:3000` (dev) or `https://jobnomad.app` (prod)
2. **Redirect URLs**: Add:
   - `http://localhost:3000/auth/callback`
   - `https://jobnomad.app/auth/callback` (production)

### Auth Providers (Authentication > Providers)

1. **Email**: Enable
2. **Confirm email**: Enable
3. **Secure email change**: Enable
4. **Double confirm changes**: Enable (production)

### SMTP (Authentication > SMTP Settings) - Production Only

Configure Resend as custom SMTP:

| Field | Value |
|-------|-------|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key (`re_...`) |
| Sender email | `auth@yourdomain.com` |
| Sender name | `JobNomad` |

### Email Templates (Authentication > Email Templates)

**Magic Link** template:

```html
<h2>Sign in to JobNomad</h2>
<p>Click the button below to sign in. This link expires in 1 hour.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#3a7ca5;color:#fff;text-decoration:none;border-radius:8px;">
    Sign in to JobNomad
  </a>
</p>
<p style="color:#666;font-size:13px;">
  If you didn't request this, you can safely ignore this email.
</p>
```

**Confirm Signup** template (for new users):

```html
<h2>Welcome to JobNomad</h2>
<p>Confirm your email to start receiving personalized remote job matches.</p>
<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#3a7ca5;color:#fff;text-decoration:none;border-radius:8px;">
    Confirm my email
  </a>
</p>
<p style="color:#666;font-size:13px;">
  If you didn't sign up for JobNomad, you can safely ignore this email.
</p>
```

## 3. Database Migration

Push the rate-limiting migration:

```bash
supabase db push
```

This creates:
- `auth_rate_limits` table (RLS enabled, service_role only)
- `check_auth_rate_limit()` RPC function
- `cleanup_auth_rate_limits()` RPC for cron cleanup

Verify with the pgTAP test:

```bash
supabase test db
```

## 4. Auth Flow

```
User visits /auth/login
    |
    v
Enters email -> sendMagicLink server action
    |
    +--> Zod validation (trim, lowercase, format)
    +--> Rate limit check (hashed IP via RPC)
    +--> supabase.auth.signInWithOtp({ email, emailRedirectTo })
    |
    v
User receives email with magic link
    |
    v
Clicks link -> Supabase redirects to /auth/callback?code=...
    |
    v
/auth/callback exchanges code for session
    |
    +--> exchangeCodeForSession(code)
    +--> Validates ?next= param (open-redirect protection)
    +--> Redirects to /feed (or validated next path)
    |
    v
/feed (protected) -> getUser() checks session
```

## 5. Security Measures

| Layer | Protection |
|-------|-----------|
| Input validation | Zod schemas on all form data |
| Email enumeration | Always returns "check your email" (even on errors) |
| Rate limiting | 5 attempts per IP per hour (hashed IP, RGPD compliant) |
| Open redirect | `isValidReturnTo()` blocks protocol-relative, schemes, encoded bypasses |
| PKCE | Supabase PKCE flow (code exchange, not implicit) |
| Session | Server-side JWT validation via `getUser()` (not `getSession()`) |
| Signout | POST-only route handler (prevents CSRF via GET prefetch) |
| Headers | X-Frame-Options, HSTS, CSP basics, Referrer-Policy |
| Proxy | `proxy.ts` refreshes JWT on every matched request |

## 6. Testing

```bash
# Unit tests (pure functions)
npx vitest run

# E2E tests (requires Playwright browsers)
npx playwright install chromium
npx playwright test

# pgTAP (requires local Supabase)
supabase test db
```

## 7. Manual Testing Checklist

- [ ] Visit `/auth/login` -> form renders
- [ ] Submit valid email -> "Check your email" shown
- [ ] Submit invalid email -> validation error shown
- [ ] Click magic link in email -> redirected to `/feed`
- [ ] Visit `/feed` without auth -> redirected to `/auth/login`
- [ ] Visit `/auth/error?reason=link_expired` -> correct error message
- [ ] Visit `/auth/callback` without code -> redirected to error page
- [ ] Sign out from `/feed` -> redirected to `/auth/login`

## 8. Troubleshooting

**"Environment validation failed"**: Check `.env.local` has all required vars. See `.env.example`.

**Magic link not received**: 
- Check spam folder
- Verify Supabase SMTP settings (or use default Supabase SMTP for dev)
- Check Supabase logs (Dashboard > Logs > Auth)

**"Link expired"**: Magic links expire after 1 hour. Request a new one.

**Rate limited in dev**: The `auth_rate_limits` table resets after the window (60 min). To clear manually:
```sql
DELETE FROM auth_rate_limits;
```
