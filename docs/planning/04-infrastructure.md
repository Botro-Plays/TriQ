# TriQ — Infrastructure & Deployment (Render + Supabase)

## Current Setup

| Resource | Value |
|----------|-------|
| **Hosting** | Render (Free Tier) |
| **Database** | Supabase PostgreSQL (Free Tier, 500MB) |
| **Domain** | `triq.dpdns.org` (Cloudflare DNS-only) |
| **Render URL** | `https://triq-0h54.onrender.com` |
| **Supabase Project** | `mzyajzfatmrwzdjmhqnm` |
| **Supabase Region** | ap-northeast-2 (Seoul) |
| **Node.js** | 24.x (Render default) |

---

## 1. Render Web Service

### Configuration

| Setting | Value |
|---|---|
| Repository | `https://github.com/Botro-Plays/TriQ` |
| Branch | `main` |
| Root Directory | `apps/server` |
| Build Command | `npm install --include=dev && cd ../web && npm install --include=dev && npm run build && cd ../server && npx prisma generate && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/health` |
| Auto-Deploy | On Commit |

### Environment Variables

| Key | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.mzyajzfatmrwzdjmhqnm:PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres` |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (base64-encoded random secret) |
| `FIREBASE_PROJECT_ID` | `triq-35908` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/etc/secrets/firebase-service-account.json` |

### Secret File

Firebase service account JSON stored as a Render Secret File:
- **Filename:** `firebase-service-account.json`
- **Mounted at:** `/etc/secrets/firebase-service-account.json`

---

## 2. Supabase Database

### Connection

Supabase free tier uses **IPv6-only** for direct connections. Use the **Session Pooler** for IPv4 connectivity:

- **Direct (IPv6):** `db.mzyajzfatmrwzdjmhqnm.supabase.co:5432` — does not work from Render
- **Session Pooler (IPv4):** `aws-1-ap-northeast-2.pooler.supabase.com:5432` — works from Render

**Important:** URL-encode special characters in the password (`!` → `%21`, `@` → `%40`).

### Migrations

Migrations are run **manually** via the Supabase SQL Editor:
1. Go to Supabase Dashboard → SQL Editor
2. Paste the migration SQL from `apps/server/prisma/migrations/20260620000000_init/migration.sql`
3. Click **Run without RLS** (Prisma uses direct database access, not Supabase client libraries)

The migration SQL includes `_prisma_migrations` table tracking so Prisma knows the migration was applied.

---

## 3. Cloudflare DNS

| Record | Type | Value | Proxy |
|--------|------|-------|-------|
| `triq.dpdns.org` | CNAME | `triq-0h54.onrender.com` | DNS only |
| `www.triq.dpdns.org` | CNAME | `triq-0h54.onrender.com` | DNS only |

**DNS-only (grey cloud)** is required — Cloudflare proxy interferes with WebSocket/Socket.io connections.

---

## 4. Build & Deploy Flow

```
Developer machine
       │
       ▼
  Git push to main
       │
       ├── GitHub Actions CI (build check only)
       │
       ▼
  Render Auto-Deploy
       │
       ├── npm install --include=dev (server)
       ├── npm install --include=dev (web)
       ├── npm run build (web — tsc + vite)
       ├── npx prisma generate
       ├── npm run build (server — tsc)
       │
       ▼
  npm start (node dist/index.js)
       │
       ├── Firebase Admin init
       ├── Database seed (idempotent upsert)
       ├── Express server on 0.0.0.0:10000
       └── Socket.io ready
       │
       ▼
  Live on https://triq.dpdns.org
```

---

## 5. Free Tier Limitations

| Platform | Limitation | Impact |
|----------|-----------|--------|
| Render | Spins down after 15 min inactivity | Cold start ~30s on first request |
| Supabase | 500MB database | Sufficient for launch |
| Supabase | IPv6-only direct connection | Must use session pooler for IPv4 |
| Supabase | No daily backups (free tier) | Manual backups via SQL export |

---

## 6. Monitoring

| Tool | Purpose | Cost |
|------|---------|------|
| Render Dashboard | Deploy logs, events | Free |
| Render Health Check | Auto-restart on failure | Free |
| Supabase Dashboard | DB metrics, query logs | Free |
| `curl https://triq.dpdns.org/health` | Manual health check | Free |

---

## 7. Troubleshooting

### Database Connection Errors
- Verify `DATABASE_URL` uses the **session pooler** URL (not direct)
- Check password special characters are URL-encoded
- Ensure Supabase project status is **Healthy**

### Build Failures on Render
- Check Render build logs for TypeScript errors
- Ensure `--include=dev` is in both `npm install` commands (devDependencies needed for `tsc`)
- Verify `tsconfig.json` doesn't use deprecated `baseUrl` without `paths`

### PWA / Service Worker Issues
- Old service workers from previous deployments may cache stale responses
- Clear browser cache: DevTools → Application → Service Workers → Unregister
- The PWA is configured with `selfDestroying: true` to auto-clean stale service workers

### Cold Start Delays
- Render free tier spins down after 15 min of inactivity
- First request after idle takes ~30s to cold-start
- Consider upgrading to Render paid tier ($7/mo) for always-on
