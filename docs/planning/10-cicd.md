# TriQ — CI/CD Pipeline & Deployment

## Git Repository Structure

```
TriQ-Project-New/
├── .github/
│   └── workflows/
│       ├── ci.yml          # Lint, typecheck, unit tests
│       ├── integration.yml # Integration tests with DB
│       └── deploy.yml      # Deploy to VPS
├── apps/
│   ├── passenger-mobile/   # React Native (Expo)
│   ├── driver-mobile/      # React Native (Expo)
│   ├── web-passenger/      # React + Vite PWA
│   ├── web-admin/          # React + Vite Dashboard
│   └── landing-page/       # React + Vite (or plain HTML)
├── backend/                # Node.js + Express + TypeScript
│   ├── src/
│   ├── tests/
│   └── prisma/
├── packages/
│   ├── shared-types/       # Shared TypeScript interfaces
│   ├── shared-ui/          # Shared component primitives
│   └── eslint-config/      # Shared ESLint config
├── docker-compose.yml
└── package.json            # Root workspace config
```

---

## CI/CD Pipeline

### GitHub Actions Workflow: CI (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: triq_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run test:integration

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

### Deploy Workflow (`.github/workflows/deploy.yml`)

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [ci]
    steps:
      - uses: actions/checkout@v4
      
      # Build Docker images
      - name: Build and push Docker images
        run: |
          docker build -t triq-api:${{ github.sha }} ./backend
          docker build -t triq-web-admin:${{ github.sha }} ./apps/web-admin
          docker build -t triq-web-passenger:${{ github.sha }} ./apps/web-passenger
          docker build -t triq-landing:${{ github.sha }} ./apps/landing-page
      
      # Deploy to VPS via SSH
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/triq
            git pull origin main
            
            # Backup DB before migration
            docker compose exec -T postgres pg_dump -U triq triq_prod > backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sql
            
            # Build and restart
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --build
            
            # Run migrations
            docker compose exec api npx prisma migrate deploy
            
            # Health check
            curl -f http://localhost:4000/health || exit 1
            
            # Cleanup old images
            docker image prune -f
```

---

## Deployment Strategy

### Environments

| Environment | Purpose | Auto-deploy |
|-------------|---------|-------------|
| **Local** | Development | Manual (`docker compose up`) |
| **Staging** | Pre-production testing | On push to `develop` |
| **Production** | Live app | On push to `main` |

### Zero-Downtime Deployment

1. **Blue-Green with Docker Compose**:
   - Run new containers on different ports
   - Health check passes -> Nginx switches upstream
   - Old containers stopped after 30s grace period

2. **Database Migrations**:
   - Always backward-compatible migrations
   - Deploy code first, then migrate (or vice versa for additive changes)
   - Never drop columns in same deploy as code removal

### Rollback Procedure

```bash
# Emergency rollback on VPS
ssh triq@vps

cd /opt/triq

# Option 1: Rollback to previous Docker image
docker compose -f docker-compose.prod.yml down
docker tag triq-api:previous triq-api:latest
docker compose -f docker-compose.prod.yml up -d

# Option 2: Rollback DB migration (if needed)
docker compose exec api npx prisma migrate resolve --rolled-back "20260115000000_bad_migration"

# Option 3: Git revert
git revert HEAD
git push origin main
```

---

## Docker Configuration

### Backend Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 4000
USER node
CMD ["node", "dist/index.js"]
```

### Production Docker Compose (`docker-compose.prod.yml`)

```yaml
version: '3.8'

services:
  api:
    image: triq-api:latest
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_PRIVATE_KEY=${JWT_PRIVATE_KEY}
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - PAYMONGO_SECRET_KEY=${PAYMONGO_SECRET_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - triq
    read_only: true
    tmpfs:
      - /tmp

  postgres:
    image: postgis/postgis:16-3.4
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    environment:
      - POSTGRES_USER=triq
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=triq_prod
    networks:
      - triq

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - triq
    command: redis-server --appendonly yes

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - certbot_data:/etc/letsencrypt
    depends_on:
      - api
    networks:
      - triq

volumes:
  postgres_data:
  redis_data:
  certbot_data:

networks:
  triq:
    internal: false
```

---

## Backup & Disaster Recovery

### PostgreSQL Backup

```bash
# Automated daily backup (cron on VPS)
0 2 * * * docker compose exec -T postgres pg_dump -U triq triq_prod | gzip > /opt/triq/backups/triq-$(date +\%Y\%m\%d).sql.gz

# Retain 30 days
0 3 * * * find /opt/triq/backups -name "*.sql.gz" -mtime +30 -delete
```

### Restore Procedure

```bash
# Stop app to prevent writes
docker compose -f docker-compose.prod.yml stop api

# Restore from backup
gunzip -c backups/triq-20260115.sql.gz | docker compose exec -T postgres psql -U triq triq_prod

# Restart app
docker compose -f docker-compose.prod.yml start api
```

### Redis Backup

```bash
# AOF persistence enabled (appendonly yes)
# Redis auto-saves to /data/appendonly.aof
# Docker volume persists this across restarts
```

---

## Mobile App Deployment

### Expo EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure builds
npx eas build:configure

# Build for production
eas build --platform android --profile production
eas build --platform ios --profile production

# OTA Updates (Expo Updates)
expo publish --channel production
```

### App Store Submission

| Platform | Steps |
|----------|-------|
| **Android** | Build AAB -> Google Play Console -> Internal Testing -> Production |
| **iOS** | Build IPA -> App Store Connect -> TestFlight -> App Store Review |

### App Versioning

- **Semantic**: `MAJOR.MINOR.PATCH` (e.g., `1.2.3`)
- **Major**: Breaking API changes
- **Minor**: New features (backward compatible)
- **Patch**: Bug fixes
- OTA updates allowed for minor/patch (Expo Updates)
- Major updates require store submission

---

## Monitoring Post-Deploy

### Health Checks

```bash
# API health
curl https://triq.app/health

# Deep health (DB + Redis)
curl https://triq.app/health/deep

# Expected responses:
# 200 OK = healthy
# 503 Service Unavailable = degraded (check logs)
```

### Post-Deploy Verification Checklist

- [ ] API responds to `/health`
- [ ] Database connections normal
- [ ] Redis memory usage < 80%
- [ ] Nginx serving static files
- [ ] SSL certificate valid
- [ ] Firebase Auth responding
- [ ] PayMongo webhooks receiving
- [ ] Socket.io connections working
- [ ] No 500 errors in last 5 minutes
