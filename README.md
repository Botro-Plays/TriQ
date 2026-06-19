# TriQ — Tricycle Hailing Platform for Digos City

[![Node.js](https://img.shields.io/badge/Node-20+-green)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/Database-MySQL-blue)](https://www.mysql.com/)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

TriQ is a real-time, geo-location based tricycle hailing platform built specifically for **Digos City, Davao del Sur, Philippines**. Passengers book rides, drivers accept them, and the platform operates on cash payments with optional digital tips.

## Architecture

```
TriQ-Project-New/
├── apps/
│   ├── server/          # Node.js + Express + Prisma + MySQL backend + Socket.io
│   └── web/             # React + Vite PWA — unified app for all roles
├── docs/planning/       # Product specs, data model, branding, infrastructure
└── .github/workflows/    # CI/CD automation
```

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js 20, Express, TypeScript, Prisma ORM |
| **Database** | MySQL (via HidenCloud) |
| **Real-time** | Socket.io |
| **Auth** | Firebase Phone OTP |
| **Payments** | PayMongo (tips only) |
| **Frontend** | React 18, Vite, Tailwind CSS, React Router v6, Zustand |
| **Maps** | Leaflet + OpenStreetMap |

## Unified Web App

One PWA serves all user roles:

| Role | Route | Features |
|---|---|---|
| **Passenger** | `/passenger` | Book rides, track drivers, manage profile |
| **Driver** | `/driver` | Go online/offline, accept requests, view earnings |
| **Admin / Staff** | `/admin` | KYC queue, driver management, ride monitoring, reports |

No separate mobile apps — works in any modern browser. Installable as PWA.

## Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/Botro-Plays/TriQ.git
cd TriQ

# 2. Install dependencies
npm install

# 3. Set up environment
cp apps/server/.env.example apps/server/.env.local
# Edit apps/server/.env.local with your MySQL credentials

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

## Deployment (HidenCloud)

**Platform:** [HidenCloud](https://www.hidencloud.com) Free Tier  
**Reverse Proxy:** `https://triq.hidenplay.net`  
**Domain:** `triq.dpdns.org` (DigitalPlat)

### HidenCloud Egg Config

| Setting | Value |
|---|---|
| Git Repo Address | `https://github.com/Botro-Plays/TriQ` |
| Install Branch | `main` |
| Auto Update | `1` |
| Main file | `apps/server/index.js` |

The entry point (`apps/server/index.js`) auto-handles:
1. `npm install` (workspace-aware)
2. `prisma generate`
3. `tsc` build
4. Start the server

### Required Environment Variables

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=mysql://user:pass@localhost:3306/triq
WEB_APP_URL=https://triq.hidenplay.net
JWT_SECRET=your-32-char-random-secret
FIREBASE_PROJECT_ID=triq-digos
PAYMONGO_SECRET_KEY=sk_test_xxx
PAYMONGO_PUBLIC_KEY=pk_test_xxx
```

## Project Principles

- **Free for passengers** — no booking fees
- **Fair for drivers** — optional subscription for visibility, not mandatory
- **Cash for rides** — driver gets paid directly in cash
- **Digital tips** — optional tips processed via PayMongo go to platform
- **Lightweight** — works on budget smartphones and slower connections
- **Zero-cost geolocation** — OpenStreetMap + Haversine, no Google Maps billing

## License

MIT
