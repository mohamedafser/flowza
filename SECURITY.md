# Security

Flowza security architecture for the Restaurant Queue Management SaaS
(Phases 1–18). This document describes how authentication, authorization,
tenant isolation, billing, and production controls work. It does **not**
contain secrets.

## Authentication architecture

- Identity is provided by **Supabase Auth** (email/password + OTP flows).
- Passwords are never stored in application tables.
- Sessions use **HTTP-only cookies** via `@supabase/ssr`. Client storage is
  never treated as proof of authorization.
- Server code verifies the user with `supabase.auth.getUser()` (not
  client-provided roles or tokens).
- Email verification is enforced for protected app routes and APIs that call
  `requireVerifiedAuth` / `requirePermission`.
- Password reset uses short-lived OTP + a server-set reset authorization cookie
  (not a long-lived recovery session alone).

## Authorization / RBAC

Restaurant permissions are role-derived (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`)
and checked server-side with `requirePermission(restaurantId, permission)`.

Platform administration uses `profiles.platform_role = SUPER_ADMIN` and
`requirePlatformPermission(...)`. Restaurant membership never grants `/admin`.

Clients cannot assign:

- `platform_role` / `SUPER_ADMIN`
- `account_status`
- their own restaurant member role (RPC rejects self role changes)

Database trigger `protect_profile_privilege_columns` blocks client updates to
privileged profile columns. Service-role ops may still change them.

## Multi-tenant isolation

- Tenant boundary is the **organization** / restaurant membership resolved
  server-side from `auth.uid()`.
- Prefer cookie preference only to pick among *already authorized*
  memberships — never as authorization by itself.
- Resource IDs from the browser (`restaurant_id`, `customer_id`, …) are always
  re-checked against membership + RLS.
- Client writes to `subscriptions` are denied (service-role / billing paths only).
- Direct `restaurant_members.role` changes are blocked; use SECURITY DEFINER RPCs.
- Public customer lookup is **exact phone only** (no anonymous name directory).
- Public join reuse requires matching guest name before returning an access token.

## Row Level Security (RLS)

- RLS is enabled on application tables. Do not disable RLS to “fix” bugs.
- Privileged cross-tenant work (platform admin, webhooks) uses the
  **service-role** client only on the server after application authorization.
- Storage logo paths are scoped as `{restaurant_id}/...` with bucket policies.

## API & Server Actions

Every mutating route / Server Action must:

1. Authenticate
2. Resolve restaurant context server-side
3. Check permission
4. Validate input with Zod
5. Enforce ownership / tenant scope

Public queue / QR / display endpoints use opaque public tokens and DTOs that
omit phone, email, notes, and internal staff data.

## Rate limiting

Sensitive paths are rate-limited in `proxy.ts` via
`lib/security/rate-limit.ts` (auth, billing, admin, webhooks, public queue).

Limits are configurable with `RATE_LIMIT_*` env vars. Counters are **per
Node/Edge isolate**. For multi-instance production, add edge/WAF limits (or a
shared store) in addition to in-app limits.

## Billing & webhooks

- `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are server-only.
- Checkout success in the browser is never final; server verification +
  webhooks update subscription state.
- `/api/webhooks/razorpay` requires signature verification and stores events
  with unique `(provider, event_id)` for idempotency.

## Secrets

Never put secrets in `NEXT_PUBLIC_*`, client bundles, git, logs, or API
errors. See `.env.example` for the public vs server split.

If a secret was ever committed, **rotate it** — removing the file is not enough.

## Data handling

- Customer phone numbers are normalized and uniqueness is restaurant-scoped
  in the database.
- Prefer masked values in logs (`maskEmail` / `maskPhone`).
- Audit metadata strips password/token/phone/email keys.
- Customer merge is not shipped as a product feature; duplicate matching is
  restaurant-scoped only.

## PWA

Service worker caching uses `NetworkOnly` for authenticated app routes, admin,
billing APIs, and private data paths. Only static/public assets use SW caches.

## Security headers

`next.config.ts` sets CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy,
Permissions-Policy, and HSTS (production). CSP allows Supabase + Razorpay
checkout without `unsafe-eval`.

## Dependency security

- Run `npm audit --omit=dev` in CI/production reviews.
- Prefer `overrides` for transitive fixes (e.g. `serialize-javascript`) over
  forced major upgrades of PWA tooling.
- Dev-only audit findings (e.g. Vitest) should not block production ship unless
  they affect the runtime dependency tree.

## Production security checklist

See [docs/PRODUCTION_SECURITY_CHECKLIST.md](./docs/PRODUCTION_SECURITY_CHECKLIST.md).

## Backup & recovery (overview)

- Use Supabase production backups (PITR where enabled) and test restore.
- Keep migrations versioned; prefer forward-fix migrations over destructive
  rollbacks in production.
- Critical recovery data: auth users, restaurants/orgs, subscriptions,
  payments, customers, queue/reservation history.
