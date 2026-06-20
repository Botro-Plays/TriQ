# TriQ — CI/CD Pipeline & Deployment (Actual)

## Git Repository Structure

```
TriQ-Project-New/
├── .github/
│   └── workflows/
│       ├── ci.yml              # Build verification (lint + typecheck)
│       └── deploy-vps.yml      # Build, package, deploy to VPS
├── apps/
│   ├── web/                    # React + Vite PWA (frontend)
│   └── server/                 # Node.js + Express + TypeScript (backend)
│       ├── src/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── seed.ts
│       │   └── migrations/     # Committed SQL migration files
│       └── config/             # Firebase service account JSON (not in git)
├── package.json                # Root workspace config
└── README.md
```

---

## CI/CD Pipeline

### GitHub Actions Workflow: Build & Deploy (`.github/workflows/deploy-vps.yml`)

```yaml
name: Build and Deploy to VPS

on:
  push:
    branches: [main]

jobs:
  lint-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint server
        run: npm run lint -w apps/server

      - name: Lint web
        run: npm run lint -w apps/web

      - name: Build server
        run: npm run build -w apps/server

      - name: Build web
        run: npm run build -w apps/web

      - name: Package frontend
        run: |
          cd apps/web
          tar -czf ../../deploy-web.tar.gz dist/

      - name: Package backend
        run: |
          cd apps/server
          tar -czf ../../deploy-server.tar.gz dist/ prisma/ package.json prisma/migrations/

      - name: Upload packages to VPS
        uses: appleboy/scp-action@v0.1.7
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          source: "deploy-web.tar.gz,deploy-server.tar.gz"
          target: "/tmp"

      - name: Deploy and restart on VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            # Deploy frontend
            rm -rf /var/www/triq/*
            tar -xzf /tmp/deploy-web.tar.gz -C /var/www/triq --strip-components=1

            # Deploy backend (preserve config/ and .env)
            cd /var/www/triq-server
            rm -rf dist prisma package.json node_modules package-lock.json
            tar -xzf /tmp/deploy-server.tar.gz -C /var/www/triq-server

            # Install dependencies and run migrations
            cd /var/www/triq-server
            npm install --production --omit=dev
            ./node_modules/.bin/prisma generate
            ./node_modules/.bin/prisma migrate deploy
            ./node_modules/.bin/prisma db seed

            # Restart PM2
            pm2 delete triq-server || true
            pm2 start dist/index.js --name triq-server --update-env
            pm2 save --force

            # Cleanup
            rm -f /tmp/deploy-web.tar.gz /tmp/deploy-server.tar.gz
```

---

## Required GitHub Secrets

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | `72.51.57.201` |
| `VPS_USER` | `triq` |
| `VPS_SSH_KEY` | Private SSH key (no passphrase) |
| `VPS_WEB_PATH` | `/var/www/triq` |
| `VPS_SERVER_PATH` | `/var/www/triq-server` |

---

## Deployment Flow

```
Developer machine
       │
       ▼
  Git push to main
       │
       ▼
  GitHub Actions Runner
       │
       ├── Build server (tsc)
       ├── Build web (vite)
       ├── Package into tarballs
       │
       ▼
  SCP to VPS (/tmp)
       │
       ▼
  SSH into VPS
       ├── Extract frontend → /var/www/triq
       ├── Extract backend → /var/www/triq-server
       ├── npm install --production
       ├── prisma generate
       ├── prisma migrate deploy (safe, never loses data)
       ├── prisma db seed (safe upsert)
       ├── pm2 restart triq-server
       └── Cleanup tarballs
       │
       ▼
  Live on https://triq.dpdns.org
```

---

## Deployment Strategy

### Environments

| Environment | Purpose | Auto-deploy |
|-------------|---------|-------------|
| **Local** | Development | Manual (`npm run dev`) |
| **Production** | Live app | On push to `main` |

### Database Migrations

- **Migration files are committed to git** (`prisma/migrations/`)
- `prisma migrate deploy` applies **only new** migrations
- **Never deletes data** — additive changes only
- `prisma db seed` uses `upsert` — safe to run repeatedly

### Rollback Procedure

```bash
# Emergency rollback on VPS
ssh triq@72.51.57.201

# Option 1: Revert git and trigger new deploy
git revert HEAD
git push origin main

# Option 2: Manual DB rollback (if migration was bad)
cd /var/www/triq-server
npx prisma migrate resolve --rolled-back "20260619142931_init"

# Option 3: Restore from MySQL backup
# gunzip -c /backups/triq-20260115.sql.gz | mysql -u triq -p triq_db
```

---

## Backup & Disaster Recovery

### MySQL Backup

```bash
# Automated daily backup via cron on VPS
crontab -e
# Add: 0 2 * * * mysqldump -u triq -p'password' triq_db | gzip > /backups/triq-$(date +\%Y\%m\%d).sql.gz

# Retain 30 days
0 3 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
```

### Restore Procedure

```bash
# Stop PM2 to prevent writes
pm2 stop triq-server

# Restore from backup
gunzip -c /backups/triq-20260115.sql.gz | mysql -u triq -p triq_db

# Restart
pm2 start triq-server
```

---

## Monitoring Post-Deploy

### Health Checks

```bash
# API health
curl https://triq.dpdns.org/api/v1

# Check PM2 status
pm2 list

# Check logs
pm2 logs triq-server --lines 20
```

### Post-Deploy Verification Checklist

- [ ] Website loads at `https://triq.dpdns.org`
- [ ] API responds to `/api/v1`
- [ ] Database migrations applied successfully
- [ ] PM2 shows `triq-server` as `online`
- [ ] Nginx serving static files
- [ ] Cloudflare SSL active
- [ ] Firebase Auth responding
- [ ] No 500 errors in last 5 minutes
