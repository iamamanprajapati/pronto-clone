# Pronto — 10-minute home services platform

A complete Snabbit/Pronto-style quick home services platform: customer app, worker (expert) app, admin ops dashboard, and one backend they all share.

## Repo layout

```
apps/
  api/        Express + TypeScript + Prisma + Redis + Socket.io + BullMQ (port 4000)
  admin/      Next.js ops dashboard (port 3000)
  customer/   Expo (React Native) customer app
  worker/     Expo (React Native) expert app
packages/
  shared/     Booking state machine, socket events, types — imported by all four
```

## Quick start

Prereqs: Node 20+, pnpm, PostgreSQL, Redis (local services or `docker compose up -d`).

```bash
pnpm install

# apps/api/.env — copy .env.example there and set DATABASE_URL
pnpm db:push          # create schema
pnpm db:seed          # demo city/zone/hub, services, pricing, workers, admin

pnpm api              # API + realtime gateway on :4000
pnpm admin            # ops dashboard on :3000
pnpm customer         # Expo dev server (customer app)
pnpm worker           # Expo dev server (expert app)
```

On a physical phone, change `extra.apiUrl` in `apps/customer/app.json` and `apps/worker/app.json` from `localhost` to your machine's LAN IP.

## Seeded demo accounts

| Who | Login | Notes |
|---|---|---|
| Admin | admin@pronto.local / admin123 | SUPER_ADMIN |
| City ops | ops.blr@pronto.local / ops123 | Bengaluru |
| Finance | finance@pronto.local / fin123 | payout runs |
| Customer | phone 9000000001 | OTP `123456` (dev) |
| Workers | phones 9000000011–16 | already ACTIVE, hub: HSR Layout |

Coupons: `FIRST50` (50% off first booking), `PRONTO20`.

## The demo loop

1. **Worker app**: log in as 9000000011 → toggle **ON DUTY** (geofenced to HSR hub; GPS denied falls back to hub coords).
2. **Customer app**: log in as 9000000001 → Home shows live experts on the collapsible map → pick tasks → duration → book (mock payment succeeds instantly).
3. **Worker app**: full-screen job offer appears (20s countdown) → accept → arrived → enter the customer's 4-digit OTP → timer + checklist → complete.
4. **Customer app**: live tracking, mid-service **+30/+60 min extension**, then rating + tip.
5. **Admin** (localhost:3000): live ops map, booking audit trail, SOS console, payout runs (maker-checker), catalog/pricing/coupons/zones, analytics.

## Architecture notes

- **One state machine** (`packages/shared/src/booking.ts`): every status change—customer, worker, admin, or system timer—goes through `transition()` in `apps/api/src/modules/bookingService.ts`, which validates the edge, appends to the append-only `BookingEvent` audit log, and fans out over Socket.io + notifications.
- **Dispatch** (`modules/dispatch.ts`): Redis GEO candidates in 2km → score (distance + idle-time fairness + rating) → offer with 20s server-side TTL (BullMQ) → next candidate → `NO_EXPERT_FOUND` after 3 rounds.
- **Location pipeline** (`modules/location.ts`): worker pings → Redis GEO + liveness TTL → 5s zone snapshots — **anonymized/grid-snapped for customers**, exact for admin. Exact live tracking only on the assigned booking's channel.
- **Payments**: `PAYMENT_PROVIDER=mock` simulates the gateway (instant success). Swap to Razorpay by implementing the marked spots in `modules/payments.ts`; DB shape and call sites don't change.
- **Notifications**: `NOTIFY_PROVIDER=log` stores in-app + logs. FCM/MSG91/WhatsApp senders plug into `modules/notifications.ts`.
- **Safety**: SOS from either app → synchronous admin broadcast → acknowledge/resolve workflow with mandatory resolution note; job-overrun anomalies auto-raise SOS.
- **Money**: all amounts in paise. Worker earns 65% of base + extensions, plus streak incentives and 100% of tips. Payout runs are maker-checker (creator cannot approve).

## Production gaps (deliberate)

- Razorpay live integration + webhook signature verification
- Real KYC vendor (Signzy/IDfy), document upload to S3
- FCM push + SMS DLT registration (start DLT early — it takes weeks)
- Android foreground service for background worker location (expo-location foreground watcher is the dev stand-in)
- Rate limiting, Sentry, structured logging, load testing
