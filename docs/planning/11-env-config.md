# TriQ — Environment Configuration & Secrets

## Environment Files

### `.env` File Inventory

| File | Purpose | Location |
|------|---------|----------|
| `.env` | Local development | `backend/.env` |
| `.env.staging` | Staging server | VPS `/opt/triq/.env.staging` |
| `.env.production` | Production server | VPS `/opt/triq/.env.production` |
| `.env.example` | Template (no secrets) | `backend/.env.example` (committed to Git) |

**Rule**: `.env` files are NEVER committed to Git. Only `.env.example` is committed.

---

## Required Environment Variables

### Database

| Variable | Local Example | Production | Description |
|----------|---------------|------------|-------------|
| `DATABASE_URL` | `postgresql://triq:password@localhost:5432/triq_dev` | `postgresql://triq:***@postgres:5432/triq_prod` | Prisma connection string |

### Redis

| Variable | Local Example | Production | Description |
|----------|---------------|------------|-------------|
| `REDIS_URL` | `redis://localhost:6379` | `redis://redis:6379/0` | Redis connection string |

### Authentication (JWT)

| Variable | Local Example | Production | Description |
|----------|---------------|------------|-------------|
| `JWT_PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----\n...` | (same format) | RS256 private key (PEM) |
| `JWT_PUBLIC_KEY` | `-----BEGIN PUBLIC KEY-----\n...` | (same format) | RS256 public key (PEM) |
| `JWT_ACCESS_EXPIRY` | `15m` | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRY` | `7d` | `7d` | Refresh token TTL |

**Generate keys**:
```bash
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
```

### Firebase

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `FIREBASE_PROJECT_ID` | Firebase project identifier | Firebase Console -> Project Settings |
| `FIREBASE_CLIENT_EMAIL` | Service account email | Firebase Console -> Service Accounts |
| `FIREBASE_PRIVATE_KEY` | Service account private key | Firebase Console -> Service Accounts -> Generate new private key |
| `FIREBASE_DATABASE_URL` | Realtime DB URL (if used) | Firebase Console |
| `FIREBASE_API_KEY` | Web API key | Firebase Console -> Project Settings -> General |
| `FIREBASE_AUTH_DOMAIN` | Auth domain | Firebase Console -> Project Settings -> General |

**Firebase Setup Steps**:
1. Go to https://console.firebase.google.com/
2. Create project "triq-app" (or your chosen name)
3. Enable **Authentication** -> **Sign-in method** -> **Phone**
4. Add authorized domain: `triq.app` (production), `localhost` (dev)
5. Go to **Project Settings** -> **Service Accounts** -> **Generate new private key**
6. Download JSON -> extract `client_email` and `private_key`
7. Go to **Project Settings** -> **General** -> copy `Project ID` and `Web API Key`

### PayMongo (Payments)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `PAYMONGO_SECRET_KEY` | Secret API key for server-side | PayMongo Dashboard -> Developers -> API Keys |
| `PAYMONGO_PUBLIC_KEY` | Public key (if needed for frontend) | PayMongo Dashboard -> Developers -> API Keys |
| `PAYMONGO_WEBHOOK_SECRET` | Webhook signature verification | PayMongo Dashboard -> Developers -> Webhooks |

**PayMongo Setup Steps**:
1. Go to https://dashboard.paymongo.com/
2. Create account / login
3. Complete business verification (if required for live mode)
4. Go to **Developers** -> **API Keys**
5. Copy **Secret Key** (starts with `sk_`)
6. Create webhook endpoint: `https://triq.app/api/v1/webhooks/paymongo`
7. Subscribe to events: `payment.paid`, `payment.failed`, `payment.expired`
8. Copy webhook secret for signature verification

### Server Config

| Variable | Local | Production | Description |
|----------|-------|------------|-------------|
| `NODE_ENV` | `development` | `production` | Environment mode |
| `PORT` | `4000` | `4000` | API server port |
| `API_URL` | `http://localhost:4000` | `https://triq.app` | Public API URL |
| `FRONTEND_URL` | `http://localhost:5173` | `https://triq.app` | Frontend origin (CORS) |
| `ADMIN_URL` | `http://localhost:5174` | `https://admin.triq.app` | Admin dashboard origin |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | `https://triq.app,https://admin.triq.app` | Allowed CORS origins |

### File Upload

| Variable | Local | Production | Description |
|----------|-------|------------|-------------|
| `UPLOAD_DIR` | `./uploads` | `/opt/triq/uploads` | Document/photo storage path |
| `MAX_FILE_SIZE` | `5242880` | `5242880` | Max upload size in bytes (5MB) |
| `UPLOAD_URL_EXPIRY` | `300` | `300` | Signed URL expiry in seconds |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | Window in ms (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `RATE_LIMIT_AUTH_MAX` | `5` | Max auth requests per window |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | Pino log level (debug, info, warn, error) |
| `LOG_PRETTY` | `true` (dev) / `false` (prod) | Pretty-print vs JSON |

---

## Secret Management on VPS

### Option A: `.env` File on VPS (Current)

```bash
# On VPS
sudo mkdir -p /opt/triq
sudo chown $USER:$USER /opt/triq

# Create production env file
nano /opt/triq/.env.production

# Set restrictive permissions
chmod 600 /opt/triq/.env.production
```

### Option B: Docker Secrets (Future)

```yaml
# docker-compose.prod.yml
services:
  api:
    secrets:
      - jwt_private_key
      - firebase_private_key
      - paymongo_secret_key

secrets:
  jwt_private_key:
    file: ./secrets/jwt-private.pem
  firebase_private_key:
    file: ./secrets/firebase-private.json
  paymongo_secret_key:
    file: ./secrets/paymongo.key
```

---

## Environment-Specific Differences

| Feature | Local | Staging | Production |
|---------|-------|---------|------------|
| **Firebase** | Emulator (optional) | Live project "triq-staging" | Live project "triq-prod" |
| **PayMongo** | Test mode (sk_test_...) | Test mode | Live mode (sk_live_...) |
| **Database** | Local Docker Postgres | VPS Postgres | VPS Postgres |
| **Redis** | Local Docker Redis | VPS Redis | VPS Redis |
| **Logs** | Pretty + file | JSON + file | JSON + file |
| **SSL** | None | Let's Encrypt | Let's Encrypt |
| **Debug** | Enabled | Disabled | Disabled |
| **OTA Updates** | Development channel | Preview channel | Production channel |

---

## `.env.example` Template

```bash
# ============================================
# TriQ Environment Configuration Template
# Copy to .env and fill in real values
# NEVER commit .env to Git
# ============================================

# Server
NODE_ENV=development
PORT=4000
API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
CORS_ORIGINS=http://localhost:5173,http://localhost:5174

# Database
DATABASE_URL=postgresql://triq:password@localhost:5432/triq_dev

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT Authentication
# Generate: openssl genrsa -out jwt-private.pem 2048
JWT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
...
-----END PUBLIC KEY-----
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_API_KEY=your-web-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com

# PayMongo
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_PUBLIC_KEY=pk_test_...
PAYMONGO_WEBHOOK_SECRET=whsec_...

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
UPLOAD_URL_EXPIRY=300

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_MAX=5

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```

---

## Local Development Setup Checklist

1. [ ] Install Docker Desktop
2. [ ] Clone repository
3. [ ] `cp backend/.env.example backend/.env`
4. [ ] Fill in Firebase credentials (create free Firebase project)
5. [ ] Fill in PayMongo test credentials (create free PayMongo account)
6. [ ] Generate JWT keys: `openssl genrsa -out jwt-private.pem 2048`
7. [ ] `docker compose up -d` (starts Postgres + Redis)
8. [ ] `cd backend && npx prisma migrate dev`
9. [ ] `cd backend && npm run dev`
10. [ ] Verify: `curl http://localhost:4000/health`
