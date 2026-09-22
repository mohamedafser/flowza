# Production security checklist

Use this before launching or promoting a Flowza environment to production.
Do **not** paste real secret values into this file or tickets.

## Supabase

- [ ] Dedicated production Supabase project (not local/dev)
- [ ] All migrations applied (`supabase db push` / CI migration path)
- [ ] RLS enabled on application tables (verify in dashboard)
- [ ] Storage bucket policies reviewed (`restaurant-logos`)
- [ ] Auth Site URL + redirect allow-list match production domain
- [ ] Email templates / SMTP configured for OTP + transactional mail
- [ ] Service role key stored only in server env (never `NEXT_PUBLIC_*`)
- [ ] SUPER_ADMIN granted only via controlled SQL / ops runbook
- [ ] Database backups enabled; PITR enabled if available
- [ ] Restore drill documented (who restores, RPO/RTO targets)

## Application / Vercel

- [ ] Production domain + HTTPS only
- [ ] Env vars set for production (see `.env.example`)
- [ ] `NEXT_PUBLIC_APP_URL` is the canonical HTTPS origin
- [ ] Security headers present (CSP, frame deny, HSTS, nosniff)
- [ ] `poweredByHeader` disabled
- [ ] PWA service worker not caching private APIs
- [ ] Error monitoring connected (e.g. Vercel logs / external APM)
- [ ] Rate-limit env overrides tuned for traffic
- [ ] Edge/WAF rate limits configured for multi-instance deploy

## Billing (Razorpay)

- [ ] Live Razorpay key id + secret in server env
- [ ] Webhook secret set; endpoint URL is HTTPS `/api/webhooks/razorpay`
- [ ] Webhook events verified with signature in staging first
- [ ] Idempotency confirmed (`webhook_events` unique provider+event_id)

## Notifications

- [ ] SMTP / Resend credentials server-only
- [ ] WhatsApp / SMS tokens server-only
- [ ] VAPID private key server-only; public key may be `NEXT_PUBLIC_*`

## Auth hardening

- [ ] Email verification required for app use
- [ ] Login / signup / OTP rate limits observed
- [ ] Forgot-password responses do not enumerate accounts
- [ ] Session cookies HttpOnly / Secure in production

## Operational monitoring signals

Watch structured `level:"security"` logs for:

- `LOGIN_FAILURE` bursts
- `RATE_LIMIT_VIOLATION`
- `WEBHOOK_SIGNATURE_FAILURE`
- `CROSS_TENANT_ATTEMPT`
- `UNAUTHORIZED_ACCESS` / admin denials
- Payment / webhook processing failures

## Post-change regression

- [ ] Signup / login / logout / password reset
- [ ] Restaurant onboarding + branch management
- [ ] Customer create/search (tenant-scoped)
- [ ] Queue join (public) + staff queue ops
- [ ] Reservations + seating
- [ ] Notifications / TV display / QR
- [ ] Billing checkout + cancel (non-prod keys first)
- [ ] SaaS Admin for SUPER_ADMIN only
- [ ] `npm run lint` / `typecheck` / `test:run` / `build`
- [ ] `npm audit` reviewed (no blind major upgrades)
