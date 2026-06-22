# TriQ — Tricycle Hailing Platform for Digos City

[![Node.js](https://img.shields.io/badge/Node-20+-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)](https://www.postgresql.org/)
[![Render](https://img.shields.io/badge/Host-Render-463E56)](https://render.com)
[![Supabase](https://img.shields.io/badge/DB-Supabase-3ECF8E)](https://supabase.com)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

TriQ is a real-time, geo-location based tricycle hailing platform built specifically for **Digos City, Davao del Sur, Philippines**. Passengers book rides, drivers accept them, and the platform operates on cash payments with optional digital tips.

## Architecture

```
TriQ-Project-New/
├── apps/
│   ├── server/          # Node.js + Express + Prisma + PostgreSQL backend + Socket.io
│   └── web/             # React + Vite PWA — unified app for all roles
├── docs/planning/       # Product specs, data model, branding, infrastructure
└── .github/workflows/    # CI build check
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20, Express, TypeScript, Prisma ORM |
| **Database** | PostgreSQL (Supabase) |
| **Hosting** | Render (free tier) |
| **Real-time** | Socket.io |
| **Auth** | Firebase Phone OTP + Google Sign-in |
| **Payments** | PayMongo (tips only) |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Zustand |
| **Maps** | Leaflet + OpenStreetMap |

## Unified Web App

One PWA serves all user roles:

| Role | Route | Features |
|---|---|---|
| **Passenger** | `/passenger` | Book rides, track drivers, manage profile, emergency button, share ride, rate/report |
| **Driver** | `/driver` | Go online/offline, accept requests, view earnings, VIP countdown timer, call passenger (VIP only) |
| **Admin / Staff** | `/admin` | KYC queue, driver management, ride monitoring, reports, emergencies, grant VIP, PayMongo config |

No separate mobile apps — works in any modern browser. Installable as PWA.

## Privacy & Safety

- **Name masking**: All ride API responses mask passenger and driver names to `First L.` format (server-side). Admin routes show full names.
- **VIP-only phone access**: Passenger phone numbers only exposed to PRO/ELITE drivers. FREE drivers see passenger ID only.
- **User IDs**: Displayed on driver and passenger profiles for reporting/reference.
- **Passenger cancel restriction**: Passengers cannot cancel rides after a driver has accepted. Contact support instead.
- **Emergency system**: Dedicated admin emergency page with alert sounds, browser notifications, and action checklist.
- **FCM push notifications**: Ride events, emergencies, subscriptions, and tips — with proper cleanup to prevent duplicates.

## Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/Botro-Plays/TriQ.git
cd TriQ

# 2. Install dependencies
npm install

# 3. Set up environment
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your PostgreSQL credentials

# 4. Generate Prisma client + migrate
npm run db:generate
npm run db:migrate
npm run db:seed

# 5. Start development
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:5173
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev:server` | Start backend with tsx watch |
| `npm run dev:web` | Start Vite dev server for PWA |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed Digos City data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run build` | Build server + web for production |

## Deployment (Render + Supabase)

**Hosting:** [Render](https://render.com) Free Tier  
**Database:** [Supabase](https://supabase.com) Free Tier (PostgreSQL)  
**Domain:** `https://triq.dpdns.org` (Cloudflare DNS-only)

### Render Web Service Config

| Setting | Value |
|---|---|
| Repository | `https://github.com/Botro-Plays/TriQ` |
| Branch | `main` |
| Root Directory | `apps/server` |
| Build Command | `npm install --include=dev && cd ../web && npm install --include=dev && npm run build && cd ../server && npx prisma generate && npm run build` |
| Start Command | `npm start` |
| Health Check | `/health` |
| Auto-Deploy | On Commit |

### Environment Variables on Render

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.mzyajzfatmrwzdjmhqnm:PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (base64-encoded random secret) |
| `FIREBASE_PROJECT_ID` | `triq-35908` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/etc/secrets/firebase-service-account.json` |

### Secret File on Render

Firebase service account JSON is stored as a Render Secret File at `/etc/secrets/firebase-service-account.json`.

### Database Migrations

Migrations are run manually via the Supabase SQL Editor (Render cannot reach Supabase's direct IPv6 connection during build). The migration SQL file is at `apps/server/prisma/migrations/20260620000000_init/migration.sql`.

### Notes

- Render free tier spins down after 15 min of inactivity (cold start ~30s)
- Supabase free tier: 500MB database, IPv6 direct connection (use session pooler for IPv4)
- Cloudflare DNS is set to DNS-only (not proxied) to avoid WebSocket/HTTP2 issues

## Project Principles

- **Free for passengers** — no booking fees
- **Fair for drivers** — optional subscription for visibility, not mandatory
- **Cash for rides** — driver gets paid directly in cash
- **Digital tips** — optional tips processed via PayMongo go to platform
- **Lightweight** — works on budget smartphones and slower connections
- **Zero-cost geolocation** — OpenStreetMap + Haversine, no Google Maps billing

## License

MIT
