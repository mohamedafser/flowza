# Flowza

Restaurant queue management SaaS — **Simplify the flow of your business.**

Phase 1 established the app/PWA foundation. Phase 2 adds the multi-tenant Supabase PostgreSQL schema, migrations, RLS foundation, seed data, and typed clients. Organization tenancy (`organizations` + `organization_id`) is the primary tenant boundary; restaurants remain organization-owned business profiles. Phase 3 adds Supabase Authentication, email verification, password reset, protected routes, and RBAC permission utilities. Phase 4 adds restaurant onboarding, restaurant/branch settings, logo storage, and restaurant/branch context switching. Phase 5 adds restaurant general settings, queue/customer configuration, operating hours, special dates, and reusable date utilities. Phase 6 adds table and seating management (create/edit/delete tables, sections, status, visual layout). Phase 7 adds restaurant-level customer records (search, filters, create/edit, duplicate detection, statistics). Phase 8 adds the staff queue engine (tokens, call next, seating, completion, ETA). Phase 9 adds the anonymous customer-facing queue (join, token, status, cancel). Phase 10 adds Supabase Realtime for staff queue, customer status, and table screens. Phase 11 adds TV / lobby public displays. Phase 12 adds printable QR codes that open the Phase 9 join experience. Phase 13 adds notification infrastructure (in-app, email, WhatsApp, SMS abstractions, preferences, templates, deduplication). Reservations, analytics, and billing remain deferred.

## Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui + Lucide React
- Supabase (client/server/middleware foundation) + PostgreSQL
- React Hook Form + Zod
- Vitest + React Testing Library + Playwright
- ESLint + Prettier + Husky + lint-staged
- PWA (`@ducanh2912/next-pwa`)

## Project structure

```text
app/                 # App Router routes (marketing, auth, dashboard, api)
components/          # ui, layout, common
lib/                 # auth, supabase, realtime, utils, validations, constants
services/            # restaurants, queues, realtime subscriptions, ...
supabase/            # migrations, seed, local CLI config
hooks/ types/ tests/ e2e/ public/
```

No `src/` directory.

## Local setup

```bash
cd flowza
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when ready
npm run dev
```

Open [http://localhost:3002](http://localhost:3002).

### Local Supabase database (Phase 2)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Podman) and the Supabase CLI (installed as a dev dependency).

```bash
npm run db:start          # start local stack; applies migrations + seed
npm run db:reset          # wipe local DB and re-apply migrations + seed
npm run db:types          # regenerate types/database.ts from local schema
npm run db:stop           # stop local stack
```

After `db:start`, copy the local API URL and anon key from `npx supabase status` into `.env.local`.

To apply migrations to a hosted Supabase project:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Never run `supabase/seed.sql` against production.

## Environment variables

| Variable                               | Description                                         |
| -------------------------------------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase project URL                                |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) — preferred    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Legacy anon/public JWT (still accepted as fallback) |
| `NEXT_PUBLIC_APP_URL`                  | App origin (default `http://localhost:3002`)        |
| `NEXT_PUBLIC_APP_NAME`                 | Display name (default `Flowza`)                     |

Never expose the Supabase **service-role** key to client-side code or `NEXT_PUBLIC_*` variables.

## Development commands

```bash
npm run dev          # local development (service worker disabled)
npm run build        # production webpack build (generates service worker)
npm run start        # serve production build
npm run lint         # ESLint
npm run typecheck    # TypeScript
npm run format       # Prettier write
npm run format:check # Prettier check
npm run db:start     # local Supabase (Docker required)
npm run db:reset     # reset local DB from migrations + seed
npm run db:types     # regenerate types/database.ts
npm run db:lint      # lint SQL schema (local DB)
```

## Testing commands

```bash
npm run test         # Vitest watch
npm run test:run     # Vitest once
npm run test:e2e     # Playwright smoke (builds/serves as configured)
```

Install Playwright browsers once:

```bash
npx playwright install
```

## PWA support

- Web app manifest: `app/manifest.ts` → `/manifest.webmanifest`
- Icons: `public/icons/` (generated from the project logo)
- Service worker: enabled in production builds via `@ducanh2912/next-pwa`
- Offline fallback: `/offline`
- Install UX: `components/common/InstallPWA.tsx` + `hooks/use-pwa-install.ts`

### Caching policy (conservative)

Cached:

- Static assets (scripts, styles, fonts, images)
- App shell / navigations with NetworkFirst (short TTL)

Never cached as live data:

- `/api/*`
- Auth responses
- Queue / table / customer / realtime endpoints
- Supabase API traffic
- Supabase API traffic

Live queue positions and table availability must always prefer fresh server data. Offline UI clearly indicates that live data requires a connection.

### PWA development notes

- Service worker registration is **disabled in `next dev`** to avoid stale caches while iterating.
- Validate installability with `npm run build && npm run start` over localhost (or HTTPS in deployed environments).
- iOS Safari does not support `beforeinstallprompt`; the install component shows Add to Home Screen guidance instead.
- After dismissing the install prompt, it stays hidden for 14 days (`flowza-pwa-install-dismissed`).

## Authentication (Phase 3)

- Email/password signup, login, logout via Supabase Auth
- **6-digit OTP** email verification (5-minute expiry, hashed server-side, single-use)
- Forgot password: `/forgot-password` → `/verify-reset-otp` → `/reset-password`
- Invitation emails for pending staff invites (SMTP), then signup OTP on the invited address
- Session cookies + `proxy.ts` route protection
- RBAC utilities: `lib/auth/` (roles, permissions, session, guards)
- Callback: `/auth/callback` (legacy link exchange kept for older emails)
- Auth context resolves `{ userId, organizationId, role }` from the session membership — never from client-supplied tenant IDs

OTP delivery uses server-side `SMTP_*` (preferred) or falls back to `RESEND_*`. OTPs are stored hashed in `auth_otps` (service-role only). Password reset requires a short-lived httpOnly authorization cookie after OTP verification — never email+OTP alone.

Auth mutations use plain JSON route handlers (not RSC server-action flight payloads):

| Method + path                    | Purpose                            |
| -------------------------------- | ---------------------------------- |
| `POST /api/auth/signup`          | Create account + send OTP          |
| `POST /api/auth/login`           | Sign in (403 + data if unverified) |
| `POST /api/auth/forgot-password` | Send password-reset OTP            |
| `POST /api/auth/verify-otp`      | Verify signup or reset OTP         |
| `POST /api/auth/resend-otp`      | Resend OTP                         |
| `POST /api/auth/reset-password`  | Set password after OTP authz       |
| `POST /api/auth/logout`          | Clear session                      |

Responses are `{ ok, data }` / `{ ok, code, message, data? }` with `Cache-Control: no-store`. An unverified login returns **403** with `data.redirectTo` pointing at `/verify-email?email=…` so the UI can navigate even when Supabase refuses a session.

Required server env: `SUPABASE_SERVICE_ROLE_KEY`, `SMTP_*` (or Resend), optional `OTP_EXPIRY_MINUTES` / `OTP_RESEND_COOLDOWN_SECONDS` / `OTP_MAX_ATTEMPTS`.

Protected: `/dashboard/*`, `/settings/*`, `/onboarding/*`  
Public auth: `/login`, `/signup`, `/forgot-password`, `/verify-reset-otp`, `/reset-password`, `/verify-email`

Unverified users are redirected to `/verify-email`.
Verified users without a restaurant membership are redirected to `/onboarding/restaurant`.

Apply migration `20260921180000_auth_otps.sql` with `npm run db:reset` or `npx supabase db push`.

## Multi-tenant architecture

Flowza uses **logical tenant isolation** in a shared PostgreSQL database (no per-client databases).

```text
                FLOWZA
                   |
            PostgreSQL DB
                   |
    +--------------+--------------+
    |              |              |
  Org A          Org B          Org C
    |              |              |
 Users          Users          Users
 Customers      Customers      Customers
 Queues         Queues         Queues
 Branches       Branches       Branches
```

### Organization model

- Primary tenant boundary: `organizations` (`organization_id`)
- Extensible `business_type`: `RESTAURANT` | `SALON` | `CLINIC` | `CAR_SERVICE` | `OTHER`
- Each restaurant is an organization-owned business profile (`restaurants.organization_id`, unique — 1:1 initially)
- Membership remains on `restaurant_members` (also stores `organization_id`); roles: `OWNER` | `ADMIN` | `MANAGER` | `STAFF`
- Tenant isolation answers “which org’s data?”; roles answer “what can this user do inside that org?”
- Platform/super-admin is **not** granted via organization roles

### Tenant isolation rules

1. Backend resolves `organizationId` from the authenticated membership / restaurant — never from query/body as source of truth
2. Tenant-owned queries filter by `organization_id` (and existing `restaurant_id` / branch checks)
3. Cross-tenant resource IDs return not-found / forbidden (no leakage)
4. Customer phone uniqueness is **per organization**, not global
5. RLS helpers: `is_organization_member`, `has_organization_role` (plus existing restaurant helpers)
6. Subscriptions/payments belong to the organization (paying tenant), not individual users

### Migration strategy

Migration `20260921120000_organization_tenancy.sql`:

1. Creates `organizations`, `plans`, `payments`
2. Backfills one organization per existing restaurant (**same UUID** for legacy rows so `organization_id === restaurant_id` for pre-migration data)
3. Adds `organization_id` to tenant-owned tables with sync triggers from restaurant/branch/queue parents
4. Updates `create_restaurant_with_owner` to create organization → restaurant → OWNER membership
5. Safe to re-run backfills with `ON CONFLICT` / nullable→NOT NULL after fill

Apply locally with Docker + `npm run db:reset` (or `npx supabase db push` when linked).

### Creating a new organization

Onboarding (`/onboarding/restaurant` → `create_restaurant_with_owner`) creates:

1. `organizations` row (`business_type` defaults to `RESTAURANT`)
2. `restaurants` row linked via `organization_id`
3. `restaurant_members` OWNER row for the authenticated user

### Staff & roles

UI: `/settings/members` (visible with `members.view` — OWNER, ADMIN, MANAGER; editable with `members.manage` — OWNER, ADMIN).

All staff mutations go through plain JSON route handlers, not server actions, so responses are
inspectable `{ ok, data }` / `{ ok, code, message }` with real HTTP status codes:

| Method + path                          | Purpose                                 |
| -------------------------------------- | --------------------------------------- |
| `GET /api/members`                     | Staff + pending invitations for the org |
| `POST /api/members`                    | Add or invite (`data.outcome`), 201     |
| `PATCH /api/members/[memberId]`        | Change role                             |
| `DELETE /api/members/[memberId]`       | Remove from the organization            |
| `DELETE /api/members/invitations/[id]` | Revoke a pending invitation             |

Status codes come from `statusForActionCode`: 400 validation, 403 forbidden, 404 not found,
409 conflict. The browser side lives in `lib/api/members-client.ts`.

Migration `20260921140000_organization_members.sql` adds the organization-scoped RPCs
(`list_organization_members`, `add_organization_member`, `update_organization_member_role`,
`remove_organization_member`). They are `SECURITY DEFINER` because the member list needs the
account email from `auth.users`, which RLS-only reads cannot reach. Every RPC re-derives the
organization from the membership row and re-checks the caller's role, so a member id from
another tenant is rejected.

Rules enforced in the database (mirrored in `lib/utils/members.ts` for the UI):

- Only an OWNER may grant, change, or remove OWNER access
- An organization always keeps at least one active OWNER
- Nobody can change or remove their own membership

### Invitations

`restaurant_members.user_id` requires a real `auth.users` row, so someone who has not signed
up yet cannot be a member. Migration `20260921160000_organization_invitations.sql` adds
`organization_invitations` for that case, and `invite_organization_member` picks the path:

- Email matches an existing account → membership created immediately (`outcome: ADDED`)
- No account yet → PENDING invitation parked for 14 days (`outcome: INVITED`)

An `AFTER INSERT ON auth.users` trigger (`accept_pending_invitations`) converts every live
invitation for that email into an ACTIVE membership at signup, so the invitee lands on the
dashboard instead of onboarding. Owners and admins can revoke a pending invitation; there is
one live invitation per email per organization, and re-inviting updates the role in place.

There is no invitation email — the app has no configured sender. The invite is claimed by
signing up with the same address.

Role changes are written to `audit_logs` as `member.added`, `member.invited`,
`member.invite_revoked`, `member.role_updated`, and `member.removed`, each tagged with
`organization_id` and the acting `user_id`.

### Subscription ownership

- `plans` — global catalog
- `subscriptions.organization_id` — paying tenant
- `payments.organization_id` — payment history for that tenant
- Billing UI providers remain deferred; schema is organization-based

See also: tenant isolation unit tests in `tests/tenancy/organization-isolation.test.ts`.

## Restaurant & branches (Phase 4)

- Onboarding: `/onboarding/restaurant` (creates restaurant + OWNER membership)
- API: `POST /api/restaurants` — plain JSON create endpoint used by onboarding
- API: `GET /api/branches` — backend search/filter/pagination for branches
- Restaurant settings: `/settings/restaurant` (details + logo; requires `restaurant.manage` to edit)
- Branches: `/settings/branches`, `/settings/branches/new`, `/settings/branches/[branchId]`
- Context cookies: `flowza_restaurant_id`, `flowza_branch_id` (preferences only — server still authorizes)
- Logo uploads: Supabase Storage bucket `restaurant-logos`
- Services: `services/restaurants.ts`, `services/branches.ts`, `services/storage.ts`, `services/audit.ts`

## Restaurant settings & hours (Phase 5)

- General: `/settings/general` (name, contact, timezone, date/time formats, logo)
- Operating hours: `/settings/hours` — weekly periods, branch overrides, special dates
- Queue defaults: `/settings/queue` (configuration only; no live queue yet)
- Customer experience: `/settings/customer` (configuration only)
- Tables: `restaurant_settings`, `operating_hours`, `operating_periods`, `special_hours`
- Utilities: `lib/utils/datetime.ts`, `lib/utils/hours.ts`
- Authorization: `restaurant.manage` to edit; members can view
- PWA: settings and hours remain NetworkOnly (never cached as live data)

## Tables & seating (Phase 6)

- Tables: `/dashboard/tables` — list and visual views, search, section/status filters, sorting, statistics
- Sections: `/settings/tables` — create, rename, reorder, and safe delete (move tables first)
- Mutations: server actions in `app/actions/tables.ts` → `services/tables.ts`
- Authorization: `tables.view` to view and change status; `tables.manage` to create/edit; manager+ to delete tables or manage sections
- Branch scoped: uses the existing restaurant/branch context; IDs are verified server-side
- Live updates: Supabase Realtime (`useTableRealtime`) keeps availability in sync after seating
- PWA: table pages and APIs remain NetworkOnly (never cached as live data)

## Customers (Phase 7)

- Customers: `/dashboard/customers` — restaurant-level list, search, filters, and statistics
- Create: `/dashboard/customers/new` — name, optional phone/email, duplicate detection
- Details: `/dashboard/customers/[customerId]` — profile, timestamps, activity placeholders, edit
- Mutations: server actions in `app/actions/customers.ts` → `services/customers.ts`
- Authorization: `customers.view` to view; `customers.manage` to create/edit from the customers UI (STAFF is view-only there)
- Queue walk-ins: staff with `queue.manage` may insert a customer row when adding someone to the queue; those records appear in `/dashboard/customers`
- Restaurant scoped: branch switching does not filter or duplicate customers
- Privacy: no customer PII in audit logs, URLs, or the PWA cache; deletion omitted so future queue history stays intact
- PWA: customer pages remain NetworkOnly (never cached as live data)

## Queue engine (Phase 8)

- Queue: `/dashboard/queue` — staff waitlist dashboard for the current branch
- Create/select queues, pause/resume/close, add customers, call next, skip/cancel/no-show, seat at a table, complete
- Tokens are issued by PostgreSQL (`queue_enqueue_customer`) using the branch timezone business date
- API: `POST /api/queues` — create a queue (JSON, HTTP 201)
- API: `POST /api/queues/[queueId]/entries` — add a customer (JSON, HTTP 201; 4xx/5xx on failure)
- Call next, seating, and completion are concurrency-safe RPCs with row locks
- Authorization: `queue.view` to view; `queue.manage` to operate; manager+ to create/edit queue configuration
- Branch scoped: queue IDs, customers, and tables are verified server-side
- Live updates: Supabase Realtime (`useQueueRealtime`) refreshes the dashboard without a full reload
- PWA: queue pages remain NetworkOnly (never cached as live data)

## Customer queue (Phase 9)

- Public URLs: `/queue/[restaurantSlug]/[branchSlug]`, `/join`, `/status/[accessToken]`
- Guests join without an account. Name, phone, and party size are validated server-side.
- Existing customers are reused by normalized phone; a unique restaurant+phone index prevents duplicates.
- Join uses the Phase 8 enqueue engine (`queue_insert_waiting_entry` → same token generation as staff).
- Status is authorized by a 256-bit random `public_access_token`, never by queue-entry UUID.
- Position and ETA are calculated on the server from the current queue (not stored).
- Customers may cancel when `allow_customer_cancel` is enabled and the entry is still WAITING or CALLED.
- Closed, paused, full, and outside-hours states are enforced in PostgreSQL before insert.
- Public RPCs are SECURITY DEFINER and return mapped JSON only. There is no anonymous SELECT on `customers` or `queue_entries`.
- Same-device resume stores `{ restaurantSlug, branchSlug, accessToken }` in `localStorage` key `flowza-public-queue-access`. No name/phone/email is stored. SMS/email recovery is not in this phase.
- Status polling is not the primary update path. Phase 10 uses a restricted Supabase Realtime broadcast; a 30s fallback refresh runs only when live updates are disconnected. Manual refresh remains available.
- In-memory per-instance rate limits protect discovery/join/status/cancel. This is not shared across serverless replicas.

### Supabase Auth configuration (required)

In the Supabase dashboard (or local `supabase/config.toml`):

1. Enable **Confirm email**
2. Set **Site URL** to your app origin (local: `http://localhost:3002`)
3. Add redirect URLs:
   - `{APP_URL}/auth/callback`
4. Never expose the service-role key to the client

Local emails appear in Inbucket at `http://127.0.0.1:54324` when using `npm run db:start`.

## Routes

- `/` — marketing home
- `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- `/auth/callback` — Supabase auth code exchange
- `/dashboard` → redirects to `/dashboard/overview`
- `/dashboard/overview` — static placeholder stats
- `/settings` — account + restaurant/branch shortcuts + appearance
- `/settings/general` — restaurant identity, timezone, date/time formats, logo
- `/settings/restaurant` — redirects to `/settings/general`
- `/settings/branches` — branch list and management
- `/settings/hours` — weekly operating hours, branch overrides, special dates
- `/settings/queue` — queue configuration defaults
- `/settings/customer` — customer experience preferences
- `/settings/notifications` — notification channels and defaults
- `/dashboard/tables` — table and seating management
- `/settings/tables` — table section management
- `/dashboard/customers` — customer records
- `/dashboard/customers/new` — add a customer
- `/dashboard/customers/[customerId]` — customer details and edit
- `/dashboard/queue` — staff queue engine
- `/dashboard/displays` — TV / lobby display management
- `/dashboard/qr-codes` — printable queue QR codes
- `/queue/[restaurantSlug]/[branchSlug]` — public branch queue
- `/queue/[restaurantSlug]/[branchSlug]/join` — guest join form
- `/queue/[restaurantSlug]/[branchSlug]/status/[accessToken]` — guest status
- `/display/[publicToken]` — public TV display
- `/qr/[publicToken]` — QR resolution → Phase 9 join (or unavailable)
- `/onboarding/restaurant` — first-time restaurant setup
- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/public/branches/[restaurantSlug]/[branchSlug]/queue`
- `POST /api/public/branches/[restaurantSlug]/[branchSlug]/queue/join`
- `GET /api/public/queue/[accessToken]`
- `POST /api/public/queue/[accessToken]/cancel`
- `GET /api/public/displays/[publicToken]`
- `GET /api/public/qr/[publicToken]`

## Database (Phase 2)

Multi-tenant hierarchy: `restaurants` → `branches` → operational data (`restaurant_tables`, `queues`, `displays`, `qr_codes`, `reservations`, …).

- Migrations: `supabase/migrations/`
- Dev seed: `supabase/seed.sql` (demo restaurant/branch/tables/queue only)
- RLS: member access via `auth.uid()` → `restaurant_members` → `restaurant_id`
- Types: `types/database.ts` (regenerate with `npm run db:types`)

Guest queue pages use SECURITY DEFINER RPCs (`get_public_queue_info`, `queue_join_public`, `get_public_queue_status`, `cancel_public_queue_entry`). Displays and QR codes use `get_public_display` / `get_public_qr_code`. They never grant anonymous table SELECT on customers, queue entries, displays, or QR records.

## Realtime (Phase 10)

Staff queue, customer status, and table screens subscribe to **Supabase Realtime**. There is no custom WebSocket server, Socket.IO, Redis, or polling-as-primary-updates.

### Published tables

Added to `supabase_realtime` (idempotent) in `supabase/migrations/20260918200000_realtime_infrastructure.sql`:

- `queue_entries`
- `queue_events`
- `queues`
- `restaurant_tables`

`customers` is **not** published. Replica identity is `FULL` so RLS-aware UPDATE/DELETE payloads work.

### Channel names

Deterministic, UUID-only, never include phones, emails, names, or access tokens:

```text
restaurant:{restaurantId}:queue:{queueId}
restaurant:{restaurantId}:branch:{branchId}:tables
```

### Authorization

- **Staff** use authenticated `postgres_changes` on the published tables. RLS (`is_restaurant_member` / `is_branch_member`) is the security boundary. Client filters (`queue_id`, `branch_id`) narrow traffic; they are not a substitute for RLS.
- **Guests** do **not** receive `postgres_changes` on `queue_entries`. A database trigger broadcasts `{ "source": "<table>" }` on the public queue topic. Guests then re-fetch status through the existing access-token API.
- Realtime events never run Call Next / Seat / Skip / Cancel / Complete. They only refresh authoritative service data.
- Public access tokens are not JWTs and do not grant table SELECT.

### Client architecture

```text
lib/realtime/           # channel names, payload sanitization, coalesced refresh
services/realtime/      # subscribeToQueue / subscribeToPublicQueue / subscribeToTables
hooks/realtime/         # useQueueRealtime, usePublicQueueRealtime, useTableRealtime
```

Subscriptions are created in a `useEffect` and removed on unmount, queue change, branch change, or terminal customer status. Duplicate events are ignored by stable IDs. Overlapping refreshes are coalesced so realtime + mutation + manual refresh cannot stack identical requests.

### Fallback

If Realtime disconnects, staff and customer screens keep working. Queue actions still go through server actions. Manual refresh remains. Customers use a 30s fallback refresh only while live updates are down and the entry is still WAITING or CALLED.

### Local debugging

1. `npm run db:start` (Realtime is part of the local Supabase stack).
2. Confirm `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key in `.env.local`.
3. Open the staff queue or guest status page and watch the browser WebSocket to `/realtime/v1`.
4. Staff should see `postgres_changes` on the scoped channel. Guests should see `broadcast` / `queue_changed` only.
5. If staff see no events, check RLS membership and that the table is in `supabase_realtime`.
6. If guests see no events, confirm `realtime.send` exists on the local stack and that the status payload includes `realtimeChannel`.
7. Never put the service-role key in `NEXT_PUBLIC_*`.

### PII rules

Realtime payloads used by the UI contain only identifiers (`id`, `queue_id`, `branch_id`, `source`). Names, phones, emails, and `public_access_token` must not be applied as application state from a websocket message. Guest screens still load their own token, position, and ETA from `GET /api/public/queue/[accessToken]`.

## TV displays (Phase 11)

- Staff: `/dashboard/displays` — create/edit TV displays bound to a branch queue
- Public: `/display/[publicToken]` — now-serving + next tokens only (never customer PII)
- Tokens: 256-bit URL-safe `public_token` via `generate_display_public_token()`
- Authorization: `displays.view` / `displays.manage` (STAFF is view-only)
- Absolute URLs use `NEXT_PUBLIC_APP_URL` through `getPublicDisplayUrl()` in `lib/utils/public-urls.ts`

## QR codes (Phase 12)

Staff create printable QR codes that open the Phase 9 customer queue join experience.

### Flow

```text
Staff creates QR → QR encodes /qr/<publicToken>
Customer scans → resolve token → redirect to /queue/<restaurantSlug>/<branchSlug>/join
Customer joins → Phase 8 engine → secure status page (Phase 10 realtime)
```

### Architecture

- Table: `qr_codes` (restaurant + branch + queue scoped, `type = QUEUE_JOIN`)
- Secure `public_token` from `generate_qr_public_token()` (`gen_random_bytes(32)`, URL-safe) — not derived from restaurant/branch/queue IDs
- Public resolver: `get_public_qr_code(p_public_token)` (SECURITY DEFINER) returns only safe names/slugs + `join_path`
- Staff UI: `/dashboard/qr-codes` — list, create, edit, preview, download SVG/PNG, print, activate/deactivate, regenerate
- Canonical URLs: `lib/utils/public-urls.ts` (`getPublicQRCodeUrl`, `getPublicQueueJoinUrl`, …)
- Permissions: `qr_codes.view` / `qr_codes.manage` (mirrors displays: STAFF view-only)
- Audit: `qr_code.created|updated|activated|deactivated|token_regenerated` (tokens stripped from metadata)
- Inactive / regenerated tokens show: “This QR code is currently unavailable.”
- QR images are generated client-side from the public URL (not stored in the database)
- Destination URLs are never free-form — staff pick branch + queue only

### Local testing

1. Apply migrations (`npm run db:reset` or push the `qr_codes` migration).
2. Set `NEXT_PUBLIC_APP_URL=http://localhost:3002`.
3. Open `/dashboard/qr-codes`, create a QR for an active branch queue.
4. Preview / download SVG, or copy the URL and open `/qr/<token>` in a private window.
5. Confirm redirect to `/queue/.../join`, then join and verify status.
6. Deactivate the QR and confirm the unavailable message.
7. Regenerate the token and confirm the old printed URL stops working.

Do not log or document real production tokens.

## Notifications (Phase 13)

Queue and staff notifications run through a provider-agnostic service. Queue mutations stay non-blocking; delivery failures never break join/call/seat flows.

### Architecture

```text
Queue event → sendNotification / notifyQueue*
    → preferences + restaurant settings
    → template
    → notification_enqueue (idempotent)
    → notification_claim
    → dispatcher → email | whatsapp | sms | in-app
    → notification_mark_delivery
```

- Core: `lib/notifications/` (`service`, `dispatcher`, `templates`, `providers/*`)
- Queue hooks: `lib/notifications/queue.ts` (joined / called / cancelled / no-show / seated)
- Staff UI: header `NotificationBell` + `/api/notifications`
- Settings: `/settings/notifications` (channels + customer/staff defaults)
- DB: extended `notifications`, `notification_reads`, `customer_notification_preferences`

### Channels & providers

| Channel  | Provider abstraction  | Enabled when                                                   |
| -------- | --------------------- | -------------------------------------------------------------- |
| IN_APP   | Record + staff bell   | Restaurant setting on (default)                                |
| EMAIL    | Resend HTTP API       | `RESEND_API_KEY` + `RESEND_FROM_EMAIL` + setting               |
| WHATSAPP | Meta Cloud API        | `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` + setting |
| SMS      | Generic HTTP endpoint | `SMS_PROVIDER_API_KEY` + `SMS_PROVIDER_ENDPOINT` + setting     |

Never put provider secrets in `NEXT_PUBLIC_*`. Use `SUPABASE_SERVICE_ROLE_KEY` on the server so public join/cancel can enqueue notifications under RLS.

### Deduplication

Idempotency key: `queue_entry_id:type:channel:eventVersion` with a unique DB constraint. Concurrent retries claim with `notification_claim` so providers are not called twice.

### PWA

`/api/notifications` and authenticated settings remain NetworkOnly (never cached).

## Architecture direction

```text
UI → Route Handler / Server Action → Validation → Service → Supabase → PostgreSQL
```

Authorization: authenticate → verify email → resolve membership → check permission (server-side). Client UI may hide actions; server enforcement is mandatory.

Use Server Components by default; add `"use client"` only when required.
