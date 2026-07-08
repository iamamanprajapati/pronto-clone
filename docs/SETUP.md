# Running Pronto locally

## Prerequisites (one-time)

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | |
| pnpm | 9+ | `npm i -g pnpm` |
| PostgreSQL | 16 | `brew install postgresql@16 && brew services start postgresql@16` |
| Redis | 7 | `brew install redis && brew services start redis` |

For the mobile apps, either **Expo Go** on a physical phone (easiest), Xcode (iOS simulator), or Android Studio (Android emulator).

## First-time setup

```bash
cd pronto-clone
pnpm install                 # install all workspace deps
createdb pronto              # create the database (skip if it exists)
pnpm db:push                 # create schema
pnpm db:seed                 # load demo data
```

`apps/api/.env` should point at your local services:
```
DATABASE_URL=postgresql://<you>@localhost:5432/pronto
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-me
PORT=4000
PAYMENT_PROVIDER=mock
NOTIFY_PROVIDER=log
DEV_STATIC_OTP=123456
```

## Run (each in its own terminal)

```bash
pnpm api        # backend + realtime  → http://localhost:4000
pnpm admin      # ops dashboard       → http://localhost:3000
pnpm customer   # Expo (customer app)
pnpm worker     # Expo (expert app)
```

Reset the database anytime with `pnpm db:push && pnpm db:seed`.

## Demo accounts

| App | Login |
|---|---|
| Admin (localhost:3000) | `admin@pronto.local` / `admin123` |
| Customer app | phone `9000000001`, OTP `123456` |
| Worker app | phone `9000000011`–`16`, OTP `123456` |

Coupons: `FIRST50`, `PRONTO20`.

## Notes

- **Physical phone:** set `extra.apiUrl` in `apps/customer/app.json` and `apps/worker/app.json` to your Mac's LAN IP (`ipconfig getifaddr en0`). On a simulator, `localhost` works as-is.
- **Live-map demo:** start the worker app, log in, and toggle **ON DUTY** to place a live expert on the map before booking from the customer app.
- Payments (mock), OTP (static `123456`), and notifications (logged + in-app) use local stand-ins — no real money/SMS/push. Everything else is the real production logic.
