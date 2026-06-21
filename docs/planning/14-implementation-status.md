# TriQ — Implementation Status Audit
> Last updated: 2026-06-21
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
| Express server setup | ✅ | `src/index.ts` | Helmet, CORS, morgan, rate limiter, request logger, error handler, static PWA serving |
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
| Get passenger by userId | ✅ | `GET /api/v1/passengers?userId=xxx` — returns id, name, photoUrl, kycStatus, trustScore |
| Get passenger profile | ✅ | `GET /api/v1/passengers/:id` — full profile with home/work locations, emergency contact |
| Ride history | ✅ | `GET /api/v1/passengers/:id/rides` — paginated, includes driver info, review, pickup/dropoff coords, driver subscription status |
| Save favorite place | ✅ | `POST /api/v1/passengers/:id/places` — saves home/work location |
| Submit KYC documents | ❌ | `POST /api/v1/passengers/:id/kyc` — not yet implemented |
| Earned badges | ❌ | `GET /api/v1/passengers/:id/badges` — not yet implemented |
| Points history | ❌ | `GET /api/v1/passengers/:id/points` — not yet implemented |
| Saved places | ❌ | `GET /api/v1/passengers/:id/places` — not yet implemented |

### 1.5 Driver Routes (`src/routes/driver.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Get driver by userId | ✅ | `GET /api/v1/drivers?userId=xxx` — full driver profile |
| Get driver profile | ✅ | `GET /api/v1/drivers/:id` — full profile |
| Go online with location | ✅ | `PATCH /api/v1/drivers/:id/online` — sets isOnline, updates lat/lng |
| Go offline | ✅ | `PATCH /api/v1/drivers/:id/offline` — sets isOnline false |
| Update location | ✅ | `PATCH /api/v1/drivers/:id/location` — updates currentLat/lng |
| Update pickup radius | ✅ | `PATCH /api/v1/drivers/:id/radius` — updates pickupRadius |
| Ride history | ✅ | `GET /api/v1/drivers/:id/rides` — paginated with passenger info |
| Earnings summary | ✅ | `GET /api/v1/drivers/:id/earnings` — today/week/month/all-time aggregates |
| Find nearby drivers | ✅ | `GET /api/v1/drivers/nearby` — lat/lng/radius query with subscription tier sorting |
| Earned badges | ❌ | `GET /api/v1/drivers/:id/badges` — not yet implemented |
| Points history | ❌ | `GET /api/v1/drivers/:id/points` — not yet implemented |

### 1.6 Ride Routes (`src/routes/ride.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create ride request | ✅ | `POST /api/v1/rides` — per-pax pricing, LGU discounts, baggage fee, driver tip, preferredDriverId (rebook) |
| Get pending rides | ✅ | `GET /api/v1/rides/pending` — filtered by radius, auto-cancel stale, rebook rides only visible to preferred driver |
| Fare estimate | ✅ | `GET /api/v1/rides/estimate` — per-pax with discounts, distance, fare breakdown |
| Get active ride | ✅ | `GET /api/v1/rides/active` — by passengerId or driverId, includes driver/passenger/review |
| Get ride details | ✅ | `GET /api/v1/rides/:id` — includes status history |
| Driver accepts ride | ✅ | `POST /api/v1/rides/:id/accept` — validates status, blocks non-preferred drivers for rebook rides |
| Driver declines ride | ✅ | `POST /api/v1/rides/:id/decline` |
| Cancel ride | ✅ | `POST /api/v1/rides/:id/cancel` — with reason |
| Mark arriving | ✅ | `POST /api/v1/rides/:id/arriving` |
| Start ride | ✅ | `POST /api/v1/rides/:id/start` |
| Complete ride | ✅ | `POST /api/v1/rides/:id/complete` — sets finalFare, updates driver stats |
| Counter-offer | ✅ | `POST /api/v1/rides/:id/counter-offer` — driver proposes fare |
| Accept counter-offer | ✅ | `POST /api/v1/rides/:id/counter-offer/accept` |
| Reject counter-offer | ✅ | `POST /api/v1/rides/:id/counter-offer/reject` |
| Emergency alert | ✅ | `POST /api/v1/rides/:id/emergency` — creates EmergencyEvent |
| Submit review | ✅ | `POST /api/v1/rides/:id/review` — rating + thumbs up + comment, updates driver rating |
| Driver→Passenger feedback | ✅ | `POST /api/v1/rides/:id/passenger-feedback` — driver gives thumbs up/down to passenger after completed ride |
| Rebook (subscription perk) | ✅ | `preferredDriverId` field on Ride — only drivers with ACTIVE PRO subscription can be rebooked; ride only visible to preferred driver; only preferred driver can accept |

### 1.7 Admin Routes (`src/routes/admin.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Overview stats | ✅ | `GET /api/v1/admin/stats/overview` — passengers, drivers, online, rides, completed, KYC pending, suspended, subscription revenue, tip revenue, total fares, subscription tier breakdown |
| KYC pending list | ✅ | `GET /api/v1/admin/kyc/pending` — paginated with documents |
| KYC approve | ✅ | `POST /api/v1/admin/kyc/:documentId/approve` |
| KYC reject | ✅ | `POST /api/v1/admin/kyc/:documentId/reject` — with reason |
| Driver list | ✅ | `GET /api/v1/admin/drivers` — paginated with filters |
| Suspend driver | ✅ | `POST /api/v1/admin/drivers/:id/suspend` |
| Unsuspend driver | ✅ | `POST /api/v1/admin/drivers/:id/unsuspend` |
| Ride list | ✅ | `GET /api/v1/admin/rides` — paginated with filters |
| Report list | ✅ | `GET /api/v1/admin/reports` — paginated |
| Resolve report | ✅ | `POST /api/v1/admin/reports/:id/resolve` |
| User list | ✅ | `GET /api/v1/admin/users` — paginated |
| Update user role | ✅ | `PATCH /api/v1/admin/users/:id/role` |
| Subscriptions list | ✅ | `GET /api/v1/admin/subscriptions` — paginated with driver info |
| Tips list | ✅ | `GET /api/v1/admin/tips` — paginated with status filter |
| Passengers list | ✅ | `GET /api/v1/admin/passengers` — paginated with search, KYC status, trust score |
| Suspend passenger | ✅ | `POST /api/v1/admin/passengers/:id/suspend` |
| Reinstate passenger | ✅ | `POST /api/v1/admin/passengers/:id/reinstate` |
| Ratings list | ✅ | `GET /api/v1/admin/ratings` — paginated with rating level filter |
| Strikes list | ✅ | `GET /api/v1/admin/strikes` — paginated |
| Revoke strike | ✅ | `POST /api/v1/admin/strikes/:id/revoke` |
| Emergency events | ✅ | `GET /api/v1/admin/emergencies` — paginated |
| System config list | ✅ | `GET /api/v1/admin/config` — all key-value entries |
| Update config | ✅ | `PATCH /api/v1/admin/config/:key` — update value |

### 1.8 Leaderboard Routes (`src/routes/leaderboard.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Driver leaderboard | ✅ | `GET /api/v1/leaderboards/drivers` — period (week/month/alltime), metric (rides/earnings/rating), pagination |
| Passenger leaderboard | ✅ | `GET /api/v1/leaderboards/passengers` — period (week/month/alltime), metric (rides/tips/ratings), pagination. Ratings metric = driver thumbs-up approval rate |

### 1.9 Tips (`src/routes/tip.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create platform tip | ✅ | `POST /api/v1/tips` — creates tip record |
| PayMongo webhook | 🟡 | `POST /api/v1/tips/webhook` — webhook handler exists, PayMongo integration partial |
| Check tip status | ✅ | `GET /api/v1/tips/:id/status` |

### 1.10 Reports (`src/routes/report.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Create report | ✅ | `POST /api/v1/reports` — with category, description, ride link |
| Get report details | ✅ | `GET /api/v1/reports/:id` |

### 1.11 Middleware
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Error handler | ✅ | `src/middleware/errorHandler.ts` | Returns JSON error with status code, hides stack in production |
| Rate limiter | ✅ | `src/middleware/rateLimiter.ts` | 100 req/15min default, 10 req/15min for auth |
| Request logger | ✅ | `src/middleware/requestLogger.ts` | Logs method, URL, duration |
| Auth middleware (JWT verify) | ❌ | 📋 | Needed for protected routes — not yet created |
| Admin middleware (role check) | ❌ | 📋 | Commented out in admin.ts — not yet created |

### 1.12 Firebase Admin (`src/lib/firebaseAdmin.ts`)
| Feature | Status | Notes |
|---------|--------|-------|
| Initialize from service account | ✅ | Loads JSON cert from `FIREBASE_SERVICE_ACCOUNT_PATH` |
| Fallback to projectId-only | ✅ | Works if no service account file (for dev) |
| Verify Firebase ID token | ✅ | `verifyFirebaseToken(idToken)` — used by auth route |

### 1.13 Prisma / Database
| Feature | Status | Notes |
|---------|--------|-------|
| Full schema (525+ lines) | ✅ | `prisma/schema.prisma` — all models, `preferredDriverId` on Ride, `PassengerFeedback` model for driver→passenger feedback |
| PostgreSQL (Supabase) | ✅ | Migrated from MySQL to Supabase PostgreSQL with connection pooling |
| Seed script | ✅ | `prisma/seed.ts` — Digos City, fare rate, system config, owner account |
| Database connection | ✅ | Supabase session pooler (IPv4) |
| Migrations | ✅ | Run manually via Supabase SQL Editor |

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
| Passenger Home | ✅ | `src/pages/passenger/Home.tsx` | Map, ride booking, fare estimate, active ride card, emergency, share, report, rate, counter-offer, rebook support |
| Passenger Map | ✅ | `src/pages/passenger/Map.tsx` | Interactive OSM map with driver markers |
| Passenger Profile | ✅ | `src/pages/passenger/Profile.tsx` | Profile with saved places |
| Passenger History | ✅ | `src/pages/passenger/History.tsx` | Ride history with rate, report, rebook (subscription-gated) |
| Passenger Leaderboard | ✅ | `src/pages/shared/Leaderboard.tsx` | This Week / This Month / All Time tabs, rides/tips/ratings metrics |
| Driver Home | ✅ | `src/pages/driver/Home.tsx` | Online toggle, pending rides, active ride, counter-offer, rebook badge, post-ride passenger feedback modal (thumbs up/down) |
| Driver Earnings | ✅ | `src/pages/driver/Earnings.tsx` | Daily/weekly/monthly/all-time earnings |
| Driver Profile | ✅ | `src/pages/driver/Profile.tsx` | Profile with subscription status |
| Driver Leaderboard | ✅ | `src/pages/shared/Leaderboard.tsx` | This Week / This Month / All Time tabs, rides/earnings/rating metrics |
| Admin Dashboard | ✅ | `src/pages/admin/Dashboard.tsx` | Stats grid with total fares, subscription + tip revenue, tier breakdown |
| Admin KYC Queue | ✅ | `src/pages/admin/KycQueue.tsx` | Document review with approve/reject |
| Admin Drivers | ✅ | `src/pages/admin/Drivers.tsx` | Driver list with suspend/unsuspend |
| Admin Rides | ✅ | `src/pages/admin/Rides.tsx` | Ride monitoring with filters |
| Admin Reports | ✅ | `src/pages/admin/Reports.tsx` | Report queue with resolve |
| Admin Subscriptions | ✅ | `src/pages/admin/Subscriptions.tsx` | Subscription list with tier/status |
| Admin Tips | ✅ | `src/pages/admin/Tips.tsx` | Tip transaction log |
| Admin Passengers | ✅ | `src/pages/admin/Passengers.tsx` | Passenger list with suspend/reinstate |
| Admin Ratings | ✅ | `src/pages/admin/Ratings.tsx` | Ratings list with filter |
| Admin More | ✅ | `src/pages/admin/More.tsx` | Strikes, emergencies, system config tabs |

### 2.3 Components
| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Layout (nav + logout) | ✅ | `src/components/Layout.tsx` | Role-based navigation, leaderboard nav for passenger/driver, admin nav with all pages |
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
| All routes defined | ✅ | `src/App.tsx` | Login, passenger, driver, admin routes with role guards, leaderboard routes |
| Role-based access control | ✅ | `src/App.tsx` + `ProtectedRoute.tsx` | OWNER/STAFF share admin routes |

---

## 3. CI/CD & Infrastructure

| Feature | Status | File | Notes |
|---------|--------|------|-------|
| Render deployment | ✅ | Auto-deploy on push to main | Build: npm install + prisma generate + tsc + web build; Start: npm start |
| Supabase PostgreSQL | ✅ | Free tier, session pooler IPv4 | Connection string in DATABASE_URL env var |
| Cloudflare DNS | ✅ | `triq.dpdns.org` → Render | DNS-only proxy |
| Static file serving | ✅ | Express serves web/dist | PWA service worker self-destroying for cache cleanup |
| Migrations | ✅ | Manual via Supabase SQL Editor | `_prisma_migrations` table tracks applied migrations |

---

## 4. What's Actually Working Right Now

Users can:
1. Visit `https://triq.dpdns.org/login`
2. Sign in with **Phone OTP** (Firebase) or **Google Sign-In**
3. Select role (Passenger/Driver/Staff/Owner)
4. **Passenger**: Book rides, see fare estimates, track active ride, rate/report drivers, emergency button, share ride, view history, rebook (if driver has Pro), view leaderboard
5. **Driver**: Go online/offline, see pending ride requests, accept/counter-offer/decline, manage active ride, give passenger feedback (thumbs up/down), view earnings, view leaderboard, see rebook badges
6. **Admin/Owner**: View dashboard with stats (including total fares), manage KYC, drivers, rides, reports, passengers, subscriptions, tips, ratings, strikes, emergencies, system config
7. Logout

---

## 5. Key Architectural Decisions

- **Monetization**: Driver subscriptions (FREE/PRO) + passenger tips — platform never handles ride fares (cash-only, direct passenger→driver)
- **Rebook as subscription perk**: Only available if original driver has ACTIVE subscription; ride request visible only to the preferred driver
- **Leaderboards**: Computed via aggregation queries (no pre-computed rank column), supports week/month/alltime periods. Both drivers and passengers can see both leaderboards via Drivers/Passengers toggle. Passenger "ratings" metric uses driver thumbs-up approval rate.
- **Driver→Passenger feedback**: After completing a ride, drivers can give thumbs up/down to the passenger. One feedback per ride. Used for passenger leaderboard approval rate metric.
- **Subscription tiers**: Only FREE and PRO (ELITE removed from schema)
- **Admin earnings**: Shows subscription revenue + tip revenue (not ride fares, which are driver cash earnings)
- **Total fares card**: Shows sum of finalFare from completed rides (driver cash earnings audit, not platform revenue)
