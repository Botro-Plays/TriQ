# TriQ — Environment Configuration & Secrets

## Environment Files

### `.env` File Inventory

| File | Purpose | Location |
|------|---------|----------|
| `.env` | Local development | `apps/server/.env` |
| `.env.example` | Template (no secrets) | `apps/server/.env.example` (committed to Git) |
| Render Env Vars | Production | Render Dashboard → Environment |
| Render Secret File | Firebase JSON | Render Dashboard → Secret Files |

**Rule**: `.env` files are NEVER committed to Git. Only `.env.example` is committed.

---

## Required Environment Variables

### Database

| Variable | Local Example | Production | Description |
|----------|---------------|------------|-------------|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/triq` | `postgresql://postgres.REF:PASS@aws-1-REGION.pooler.supabase.com:5432/postgres` | Prisma connection string (PostgreSQL via Supabase) |

**Note:** In production, use the Supabase **Session Pooler** URL (IPv4). The direct connection is IPv6-only and unreachable from Render.

### Authentication (JWT)

| Variable | Local Example | Production | Description |
|----------|---------------|------------|-------------|
| `JWT_SECRET` | `your-super-secret-jwt-key` | (base64-encoded random secret) | HMAC secret for JWT signing |

**Generate JWT secret** (PowerShell):
```powershell
[Convert]::ToBase64String((1..64 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

### Firebase

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `FIREBASE_PROJECT_ID` | Firebase project identifier | Firebase Console → Project Settings |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON file | Local: `./config/firebase-service-account.json` / Render: `/etc/secrets/firebase-service-account.json` |

**Firebase Setup Steps**:
1. Go to https://console.firebase.google.com/
2. Create project "triq-35908"
3. Enable **Authentication** → **Sign-in method** → **Phone** and **Google**
4. Add authorized domain: `triq.dpdns.org` (production), `localhost` (dev)
5. Go to **Project Settings** → **Service Accounts** → **Generate new private key**
6. Download JSON — use this as the service account file

### PayMongo (Payments)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `PAYMONGO_SECRET_KEY` | Secret API key for server-side | PayMongo Dashboard → Developers → API Keys |
| `PAYMONGO_PUBLIC_KEY` | Public key (if needed for frontend) | PayMongo Dashboard → Developers → API Keys |
| `PAYMONGO_WEBHOOK_SECRET` | Webhook signing secret for verifying PayMongo callbacks | PayMongo Dashboard → Developers → Webhooks → Create Webhook |

**PayMongo Webhook URL** (copy this into PayMongo Dashboard → Developers → Webhooks):
```
https://triq.dpdns.org/api/v1/tips/webhook
```

**Setup Steps**:
1. Go to https://dashboard.paymongo.com/
2. Navigate to **Developers** → **API Keys** — copy your Secret Key (starts with `sk_`)
3. Navigate to **Developers** → **Webhooks** → **Create Webhook**
4. Set the URL to: `https://triq.dpdns.org/api/v1/tips/webhook`
5. Select events: `source.chargeable`, `payment.paid`, `payment.failed`
6. Copy the Webhook Secret (starts with `whsec_`)
7. Add all three values to Render Dashboard → Environment

### Server Config

| Variable | Local | Production | Description |
|----------|-------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment mode |
| `PORT` | `4000` | `10000` (Render default) | API server port |
| `WEB_APP_URL` | `http://localhost:5173` | (not set — same-origin) | CORS origin (leave empty for same-origin) |

---

## Production Secret Management (Render)

### Environment Variables

Set in Render Dashboard → Environment:

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.mzyajzfatmrwzdjmhqnm:PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (base64-encoded random secret) |
| `FIREBASE_PROJECT_ID` | `triq-35908` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/etc/secrets/firebase-service-account.json` |
| `PAYMONGO_SECRET_KEY` | `sk_live_xxx` (or `sk_test_xxx` for test mode) |
| `PAYMONGO_PUBLIC_KEY` | `pk_live_xxx` (or `pk_test_xxx` for test mode) |
| `PAYMONGO_WEBHOOK_SECRET` | `whsec_xxx` (from PayMongo webhook settings) |

### Secret Files

Set in Render Dashboard → Secret Files:

| Filename | Content |
|---|---|
| `firebase-service-account.json` | Firebase service account JSON (downloaded from Firebase Console) |

Render mounts secret files at `/etc/secrets/<filename>`.

---

## `.env.example` Template

```bash
# Server
NODE_ENV=development
PORT=4000

# Database (PostgreSQL via Supabase)
# Use the Session Pooler URL for IPv4 connectivity
# Encode special chars in password: ! = %21, @ = %40
DATABASE_URL="postgresql://postgres:password@localhost:5432/triq"

# Firebase Admin SDK
FIREBASE_SERVICE_ACCOUNT_PATH="./config/firebase-service-account.json"
FIREBASE_PROJECT_ID="triq-35908"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# PayMongo (for platform tips)
PAYMONGO_SECRET_KEY="sk_test_xxx"
PAYMONGO_PUBLIC_KEY="pk_test_xxx"

# Frontend URL (for CORS — leave empty for same-origin deployment)
# WEB_APP_URL="https://triq.dpdns.org"
```

---

## Local Development Setup Checklist

1. [ ] Clone repository
2. [ ] `npm install`
3. [ ] `cp apps/server/.env.example apps/server/.env`
4. [ ] Set up PostgreSQL database (local or Supabase)
5. [ ] Fill in `DATABASE_URL` with your PostgreSQL connection string
6. [ ] Download Firebase service account JSON and set `FIREBASE_SERVICE_ACCOUNT_PATH`
7. [ ] `npm run db:generate`
8. [ ] `npm run db:migrate`
9. [ ] `npm run dev:server` — verify `curl http://localhost:4000/health`
10. [ ] `npm run dev:web` — open `http://localhost:5173`
