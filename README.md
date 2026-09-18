# Flowza

Restaurant queue management SaaS — **Simplify the flow of your business.**

Phase 1 established the app/PWA foundation. Phase 2 adds the multi-tenant Supabase PostgreSQL schema, migrations, RLS foundation, seed data, and typed clients. Phase 3 adds Supabase Authentication, email verification, password reset, protected routes, and RBAC permission utilities. Phase 4 adds restaurant onboarding, restaurant/branch settings, logo storage, and restaurant/branch context switching. Phase 5 adds restaurant general settings, queue/customer configuration, operating hours, special dates, and reusable currency/date utilities. Phase 6 adds table and seating management (create/edit/delete tables, sections, status, visual layout). Phase 7 adds restaurant-level customer records (search, filters, create/edit, duplicate detection, statistics). Phase 8 adds the staff queue engine (tokens, call next, seating, completion, ETA). Phase 9 adds the anonymous customer-facing queue (join, token, status, cancel). Phase 10 adds Supabase Realtime for staff queue, customer status, and table screens. Phase 11 adds TV / lobby public displays. Phase 12 adds printable QR codes that open the Phase 9 join experience. Reservations, notifications, analytics, and billing remain deferred.

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

- Email/password signup, login, logout
- Email verification, forgot/reset password
- Session cookies + `proxy.ts` route protection
- RBAC utilities: `lib/auth/` (roles, permissions, session, guards)
- Callback: `/auth/callback`

Protected: `/dashboard/*`, `/settings/*`, `/onboarding/*`  
Public auth: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`

Unverified users are redirected to `/verify-email`.
Verified users without a restaurant membership are redirected to `/onboarding/restaurant`.

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

- General: `/settings/general` (name, contact, currency, timezone, language, date/time formats, logo)
- Operating hours: `/settings/hours` — weekly periods, branch overrides, special dates
- Queue defaults: `/settings/queue` (configuration only; no live queue yet)
- Customer experience: `/settings/customer` (configuration only)
- Tables: `restaurant_settings`, `operating_hours`, `operating_periods`, `special_hours`
- Utilities: `lib/utils/currency.ts`, `lib/utils/datetime.ts`, `lib/utils/hours.ts`
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
- `/settings/general` — restaurant identity, locale, currency, timezone, logo
- `/settings/restaurant` — redirects to `/settings/general`
- `/settings/branches` — branch list and management
- `/settings/hours` — weekly operating hours, branch overrides, special dates
- `/settings/queue` — queue configuration defaults
- `/settings/customer` — customer experience preferences
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

## Architecture direction

```text
UI → Route Handler / Server Action → Validation → Service → Supabase → PostgreSQL
```

Authorization: authenticate → verify email → resolve membership → check permission (server-side). Client UI may hide actions; server enforcement is mandatory.

Use Server Components by default; add `"use client"` only when required.
