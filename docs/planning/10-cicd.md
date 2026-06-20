# TriQ — CI/CD Pipeline & Deployment (Render + Supabase)

## Git Repository Structure

```
TriQ-Project-New/
├── .github/
│   └── workflows/
│       └── ci.yml              # Build verification (lint + typecheck)
├── apps/
│   ├── web/                    # React + Vite PWA (frontend)
│   └── server/                 # Node.js + Express + TypeScript (backend)
│       ├── src/
│       ├── prisma/
│       │   ├── schema.prisma   # PostgreSQL schema
│       │   ├── seed.ts
│       │   └── migrations/     # Committed SQL migration files
│       └── package.json
├── package.json                # Root workspace config
└── README.md
```

---

## CI: GitHub Actions (Build Check Only)

`.github/workflows/ci.yml` runs on every push to `main`:

1. Install dependencies (`npm ci`)
2. Generate Prisma client
3. Build web (`tsc && vite build`)
4. Build server (`tsc`)
5. Verify build artifacts exist

**Note:** CI does NOT deploy — it only verifies the build succeeds. Deployment is handled by Render's auto-deploy on commit.

---

## CD: Render Auto-Deploy

Render watches the `main` branch. On every push:

1. Clone the repository
2. Run the build command (installs deps, builds web + server, generates Prisma client)
3. Start the server (`npm start`)
4. Health check at `/health`

### Build Command
```
npm install --include=dev && cd ../web && npm install --include=dev && npm run build && cd ../server && npx prisma generate && npm run build
```

### Start Command
```
npm start
```

---

## Deployment Flow

```
Developer machine
       │
       ▼
  Git push to main
       │
       ├── GitHub Actions CI (build check only, runs in parallel)
       │
       ▼
  Render Auto-Deploy
       │
       ├── npm install --include=dev (server deps)
       ├── npm install --include=dev (web deps)
       ├── npm run build (web — tsc + vite build)
       ├── npx prisma generate (Prisma client)
       ├── npm run build (server — tsc)
       │
       ▼
  npm start (node dist/index.js)
       │
       ├── Firebase Admin init (from secret file)
       ├── Database seed (idempotent upsert via Prisma)
       ├── Express + Socket.io on 0.0.0.0:10000
       │
       ▼
  Live on https://triq.dpdns.org
```

---

## Database Migrations

Migrations are **not run during Render build** because Supabase's direct connection is IPv6-only (unreachable from Render). Instead:

1. Migration SQL files are committed to git (`apps/server/prisma/migrations/`)
2. Migrations are applied **manually** via Supabase SQL Editor
3. The migration SQL includes `_prisma_migrations` table tracking

### Applying a New Migration

1. Generate migration SQL locally:
   ```bash
   cd apps/server
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```
2. Save to `prisma/migrations/YYYYMMDDHHMMSS_name/migration.sql`
3. Paste the SQL into Supabase SQL Editor and run it
4. Commit and push the migration file

---

## Environments

| Environment | Purpose | Auto-deploy |
|-------------|---------|-------------|
| **Local** | Development | Manual (`npm run dev`) |
| **Production** | Live app on Render | On push to `main` |

---

## Rollback Procedure

```bash
# Option 1: Revert git commit and push (triggers Render redeploy)
git revert HEAD
git push origin main

# Option 2: Manual deploy of specific commit on Render dashboard
# Settings → Manual Deploy → Deploy specific commit
```

---

## Post-Deploy Verification Checklist

- [ ] Website loads at `https://triq.dpdns.org`
- [ ] Health check responds: `curl https://triq.dpdns.org/health`
- [ ] API responds: `curl https://triq.dpdns.org/api/v1/auth/owner-exists`
- [ ] Render logs show "Server running" and "Database seed complete"
- [ ] Firebase Auth working (test login)
- [ ] No 500 errors in Render logs
