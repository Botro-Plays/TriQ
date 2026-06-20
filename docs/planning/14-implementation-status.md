# TriQ — Implementation Status Audit
> Last updated: 2026-06-20
> This document tracks what is ACTUALLY implemented vs what is planned/stubbed.

## Legend
- **✅ Implemented** — Fully functional, tested, deployed
- **🟡 Partial** — Skeleton exists, some logic, not complete
- **❌ Stubbed** — File exists but returns 501 or placeholder UI
- **📋 Planned** — Mentioned in docs but no code yet

---

## 1. Backend (`apps/server/`)

### 1.1 Server Bootstrap
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Express server setup | ✅ | `src/index.ts` | Helmet, CORS, compression, morgan, rate limiter, request logger, error handler, static PWA serving |
| dotenv loading | ✅ | `src/index.ts` | Fixed to use `__dirname` for PM2 compatibility |
| Health check endpoint | ✅ | `src/index.ts` | `GET /health` returns `{status: 'ok'}` |
| Graceful shutdown (SIGTERM/SIGINT) | ✅ | `src/index.ts` | Closes HTTP server + Prisma disconnect |
| Socket.io scaffold | 🟡 | `src/socket/index.ts` | Connection handler exists, all ride events are TODO stubs |
| Prisma Client generation | ✅ | `prisma/schema.prisma` | Generated client packaged in CI/CD |

### 1.2 Authentication (`src/routes/auth.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Firebase Phone OTP verify | ✅ | `POST /api/v1/auth/verify-token` — verifies Firebase ID token, creates/updates user |
| Google Sign-In | ✅ | Same endpoint, extracts email from token, supports account linking |
| Account linking by phone | ✅ | If Google user provides existing phone, links to existing account (owner claiming) |
| Owner claiming | ✅ | Seeded owner (`OWNER_PENDING`) gets claimed on first Google login with matching phone |
| Prevent duplicate OWNER | ✅ | Returns 403 `OWNER_EXISTS` if trying to create second owner |
| JWT generation | ✅ | TriQ JWT with 7d expiry, includes userId, role, phone |
| JWT refresh | ✅ | `POST /api/v1/auth/refresh` — validates old token (even expired), issues new |
| Owner-exists check | ✅ | `GET /api/v1/auth/owner-exists` — returns `{ownerClaimed: boolean}` |
| Logout | ✅ | `POST /api/v1/auth/logout` — client-side only (stateless JWT) |

### 1.3 User Routes (`src/routes/user.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Get current user | ❌ | `GET /api/v1/users/me` — stub (501) |
| Update profile | ❌ | `PATCH /api/v1/users/me` — stub (501) |
| Deactivate account | ❌ | `DELETE /api/v1/users/me` — stub (501) |

### 1.4 Passenger Routes (`src/routes/passenger.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Get passenger profile | ❌ | `GET /api/v1/passengers/:id` — stub (501) |
| Submit KYC documents | ❌ | `POST /api/v1/passengers/:id/kyc` — stub (501) |
| Ride history | ❌ | `GET /api/v1/passengers/:id/rides` — stub (501) |
| Earned badges | ❌ | `GET /api/v1/passengers/:id/badges` — stub (501) |
| Points history | ❌ | `GET /api/v1/passengers/:id/points` — stub (501) |
| Save favorite place | ❌ | `POST /api/v1/passengers/:id/places` — stub (501) |
| Saved places | ❌ | `GET /api/v1/passengers/:id/places` — stub (501) |

### 1.5 Driver Routes (`src/routes/driver.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Get driver profile | ❌ | `GET /api/v1/drivers/:id` — stub (501) |
| Go online with location | ❌ | `PATCH /api/v1/drivers/:id/online` — stub (501) |
| Go offline | ❌ | `PATCH /api/v1/drivers/:id/offline` — stub (501) |
| Update location | ❌ | `PATCH /api/v1/drivers/:id/location` — stub (501) |
| Update pickup radius | ❌ | `PATCH /api/v1/drivers/:id/radius` — stub (501) |
| Ride history | ❌ | `GET /api/v1/drivers/:id/rides` — stub (501) |
| Earnings summary | ❌ | `GET /api/v1/drivers/:id/earnings` — stub (501) |
| Earned badges | ❌ | `GET /api/v1/drivers/:id/badges` — stub (501) |
| Points history | ❌ | `GET /api/v1/drivers/:id/points` — stub (501) |
| Find nearby drivers | ❌ | `GET /api/v1/drivers/nearby` — stub (501) |

### 1.6 Ride Routes (`src/routes/ride.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create ride request | ❌ | `POST /api/v1/rides` — stub (501) |
| Get ride details | ❌ | `GET /api/v1/rides/:id` — stub (501) |
| Driver accepts ride | ❌ | `POST /api/v1/rides/:id/accept` — stub (501) |
| Driver declines ride | ❌ | `POST /api/v1/rides/:id/decline` — stub (501) |
| Cancel ride | ❌ | `POST /api/v1/rides/:id/cancel` — stub (501) |
| Complete ride | ❌ | `POST /api/v1/rides/:id/complete` — stub (501) |
| Counter-offer | ❌ | `POST /api/v1/rides/:id/counter-offer` — stub (501) |
| Accept counter-offer | ❌ | `POST /api/v1/rides/:id/counter-offer/accept` — stub (501) |
| Reject counter-offer | ❌ | `POST /api/v1/rides/:id/counter-offer/reject` — stub (501) |
| Get active ride | ❌ | `GET /api/v1/rides/active` — stub (501) |
| Emergency alert | ❌ | `POST /api/v1/rides/:id/emergency` — stub (501) |

### 1.7 Admin Routes (`src/routes/admin.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| All admin endpoints | ❌ | Every endpoint returns 501 — KYC, drivers, passengers, rides, reports, audit logs, config, impersonation, stats |

### 1.8 Tips (`src/routes/tip.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create platform tip | ❌ | `POST /api/v1/tips` — stub (501) |
| PayMongo webhook | ❌ | `POST /api/v1/tips/webhook` — stub (501) |
| Check tip status | ❌ | `GET /api/v1/tips/:id/status` — stub (501) |

### 1.9 Reports (`src/routes/report.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create report | ❌ | `POST /api/v1/reports` — stub (501) |
| Get report details | ❌ | `GET /api/v1/reports/:id` — stub (501) |

### 1.10 Middleware
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Error handler | ✅ | `src/middleware/errorHandler.ts` | Returns JSON error with status code, hides stack in production |
| Rate limiter | ✅ | `src/middleware/rateLimiter.ts` | 100 req/15min default, 10 req/15min for auth |
| Request logger | ✅ | `src/middleware/requestLogger.ts` | Logs method, URL, duration |
| Auth middleware (JWT verify) | ❌ | 📋 | Needed for protected routes — not yet created |
| Admin middleware (role check) | ❌ | 📋 | Commented out in admin.ts — not yet created |

### 1.11 Firebase Admin (`src/lib/firebaseAdmin.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Initialize from service account | ✅ | Loads JSON cert from `FIREBASE_SERVICE_ACCOUNT_PATH` |
| Fallback to projectId-only | ✅ | Works if no service account file (for dev) |
| Verify Firebase ID token | ✅ | `verifyFirebaseToken(idToken)` — used by auth route |

### 1.12 Prisma / Database
| Feature | Status | Notes |
|---------|--------|-------|
| Full schema (523 lines) | ✅ | `prisma/schema.prisma` — all models from gap analysis included |
| MySQL migrations | ✅ | `prisma/migrations/` — init + add_user_email |
| Seed script | ✅ | `prisma/seed.ts` — Digos City, fare rate, system config, owner account |
| Database connection | ✅ | MySQL on VPS, working |

---

## 2. Frontend (`apps/web/`)

### 2.1 Build & Tooling
| Feature | Status | Notes |
|---------|--------|-------|
| Vite build | ✅ | `vite build` produces production bundle |
| PWA (vite-plugin-pwa) | ✅ | Service worker + manifest generated |
| TailwindCSS styling | ✅ | Custom theme with `triq-*` colors |
| TypeScript | ✅ | Full TS across frontend |

### 2.2 Pages
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| **Login page** | ✅ | `src/pages/Login.tsx` | Phone OTP + Google Sign-In, role selection, owner-exists check |
| Passenger Home | ❌ | `src/pages/passenger/Home.tsx` | Placeholder heading only |
| Passenger Map | ❌ | `src/pages/passenger/Map.tsx` | Placeholder heading only |
| Passenger Profile | ❌ | `src/pages/passenger/Profile.tsx` | Placeholder heading only |
| Driver Home | ❌ | `src/pages/driver/Home.tsx` | Placeholder heading only |
| Driver Earnings | ❌ | `src/pages/driver/Earnings.tsx` | Placeholder heading only |
| Driver Profile | ❌ | `src/pages/driver/Profile.tsx` | Placeholder heading only |
| Admin Dashboard | ❌ | `src/pages/admin/Dashboard.tsx` | Placeholder heading only |
| Admin KYC Queue | ❌ | `src/pages/admin/KycQueue.tsx` | Placeholder heading only |
| Admin Drivers | ❌ | `src/pages/admin/Drivers.tsx` | Placeholder heading only |
| Admin Rides | ❌ | `src/pages/admin/Rides.tsx` | Placeholder heading only |
| Admin Reports | ❌ | `src/pages/admin/Reports.tsx` | Placeholder heading only |

### 2.3 Components
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Layout (nav + logout) | ✅ | `src/components/Layout.tsx` | Role-based navigation, logout button |
| ProtectedRoute | ✅ | `src/components/ProtectedRoute.tsx` | JWT auth check, role-based redirect |

### 2.4 State & Data
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Auth store (Zustand) | ✅ | `src/stores/authStore.ts` | Token, user, role, persist to localStorage |
| API client (Axios) | ✅ | `src/lib/api.ts` | Base URL auto-detect, Bearer token injection |
| Firebase Auth | ✅ | `src/lib/firebase.ts` | App init, auth instance, RecaptchaVerifier export |

### 2.5 React Router
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| All routes defined | ✅ | `src/App.tsx` | Login, passenger, driver, admin routes with role guards |
| Role-based access control | ✅ | `src/App.tsx` + `ProtectedRoute.tsx` | OWNER/STAFF share admin routes |

---

## 3. CI/CD & Infrastructure

| Feature | Status | File | Notes |
|---------|--------|------|-------|
| GitHub Actions workflow | ✅ | `.github/workflows/deploy-vps.yml` | Build, package, SCP, deploy, migrate, seed, PM2 restart |
| Prisma migrate deploy | ✅ | Workflow + VPS | Migrations applied on deploy |
| Database seeding | ✅ | Workflow + VPS | Seed runs on every deploy (upsert-safe) |
| PM2 process management | ✅ | VPS | `triq-server` process auto-restarted |
| Nginx reverse proxy | ✅ | VPS | SSL via Cloudflare, routes to PM2 |
| Cloudflare DNS + SSL | ✅ | VPS | `triq.dpdns.org` |
| Root node_modules packaging | ✅ | Workflow | All deps built on GitHub Actions, VPS extracts ready-to-run |
| Prisma client copy fix | ✅ | Workflow | Copies generated client into `@prisma/client/.prisma/client` |

---

## 4. What's Actually Working Right Now

Users can:
1. Visit `https://triq.dpdns.org/login`
2. Sign in with **Phone OTP** (Firebase) or **Google Sign-In**
3. Select role (Passenger/Driver/Staff/Owner)
4. If Google user has no phone, enter phone number
5. Owner button appears only if owner is NOT yet claimed
6. Owner account (`aquariusbotro@gmail.com` + `+639564805224`) can be claimed once
7. After login, see role-appropriate navigation (all pages are placeholders)
8. Logout

---

## 5. Critical Missing Pieces (Blocking MVP)

### Must Implement Next
1. **JWT verification middleware** — `src/middleware/auth.ts` — protect all non-auth routes
2. **Admin auth middleware** — `src/middleware/admin.ts` — check OWNER/STAFF role
3. **User profile endpoints** — `GET /users/me`, `PATCH /users/me` — needed for all users
4. **KYC document upload** — `POST /passengers/:id/kyc` — file upload to storage (Firebase Storage or local)
5. **KYC approval workflow** — Admin can approve/reject KYC documents
6. **Driver online/offline toggle** — `PATCH /drivers/:id/online` + location update
7. **Find nearby drivers** — `GET /drivers/nearby` — query drivers by lat/lng/radius
8. **Create ride request** — `POST /rides` — passenger creates, find nearby drivers, broadcast via Socket.io
9. **Accept/decline ride** — driver accepts, ride status changes, passenger notified
10. **Fare estimation** — OSRM distance + Digos City rates from database

### Nice to Have Soon
11. Real-time location streaming (Socket.io driver:location → passenger)
12. Counter-offer flow
13. Complete ride + rating
14. Platform tips (PayMongo integration)
15. Report system
16. Admin dashboard with real data

---

## 6. Files Edited in This Session (2026-06-20)

| File | Change |
|------|--------|
| `apps/server/src/index.ts` | Fixed dotenv path to use `__dirname` for PM2 CWD compatibility |
| `apps/server/src/routes/auth.ts` | Added Google Sign-In support, email field, account linking, owner claiming, owner-exists endpoint |
| `apps/server/prisma/schema.prisma` | Added `email String? @unique` to User model |
| `apps/server/prisma/seed.ts` | Added owner account seed with `OWNER_PENDING` placeholder |
| `apps/server/prisma/migrations/20260620031000_add_user_email/migration.sql` | Added email column + unique index |
| `apps/web/src/pages/Login.tsx` | Added Google Sign-In button, phone collection for Google users, owner-exists check, dynamic OWNER button hiding |
| `apps/web/src/stores/authStore.ts` | Added `email?: string` to User interface |
| `.github/workflows/deploy-vps.yml` | Completely rewritten: builds on GitHub Actions, packages root node_modules, removes broken VPS npm install, copies Prisma client |
| `apps/server/package.json` | Moved `tsx` to dependencies for production seeding |
| `.gitignore` | Uncommented prisma migrations folder (now committed) |
