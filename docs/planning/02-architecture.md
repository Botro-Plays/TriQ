# TriQ — Technical Architecture

## High-Level Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Mobile App    │     │  Web Passenger  │     │  Admin Web App  │
│  (Passenger)    │     │   (Driver)      │     │     (PWA)       │     │   (React/Vite)  │
│  React Native   │◄────┼───(Expo)────────┼────►│   React + Vite  │     │                 │
│    (Expo)       │     │                 │     │                 │     │                 │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │                       │
         │   HTTPS / REST        │   HTTPS / REST        │   HTTPS / REST        │
         │   Socket.io (WS)      │   Socket.io (WS)      │   Socket.io (WS)      │
         └───────────┬───────────┴───────────┬───────────┴───────────┬───────────┘
                     │                       │                       │
          ┌──────────▼──────────┐  ┌───────▼────────┐  ┌───────────▼───────────┐
          │   Nginx Reverse     │  │  Nginx Static  │  │   Nginx Static Serve  │
          │      Proxy + SSL    │  │  (Admin + Web  │  │   (Landing Page +    │
          │   (Let's Encrypt)   │  │   Passenger)   │  │    Web Passenger)     │
          └──────────┬──────────┘  └────────────────┘  └───────────────────────┘
                     │
          ┌──────────▼──────────┐
          │   Node.js API       │
          │   Express + TS      │
          │   Socket.io Server  │
          │   Business Logic    │
          └──────────┬──────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──────┐ ┌───▼────┐ ┌─────▼──────┐
│ PostgreSQL   │ │ Redis  │ │  Firebase  │
│ + PostGIS    │ │ Cache  │ │   Auth     │
│ + Prisma ORM │ │ / Geo  │ │   + FCM    │
└──────────────┘ └────────┘ └────────────┘
```

## Technology Stack

### Mobile Applications
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React Native (Expo) | Single codebase for iOS & Android, fast dev cycles, OTA updates |
| Navigation | React Navigation | Standard RN routing |
| State Management | Zustand | Lightweight, no boilerplate vs Redux |
| Maps | OpenStreetMap + `react-native-maps` | Free, no API keys, offline tile caching possible |
| HTTP Client | Axios + React Query | Caching, retry logic, background refetch |
| Real-time | Socket.io Client | Live location, ride status updates |
| Notifications | Firebase Cloud Messaging (FCM) | Free push notifications |

### Web Passenger App (PWA)
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 + Vite | Fast, responsive web app on any device |
| PWA | Vite PWA Plugin | Installable shortcut, offline map caching |
| Styling | Tailwind CSS | Consistent with mobile app design |
| Maps | Leaflet.js + OSM | Same free maps as mobile |
| Real-time | Socket.io Client | Live ride tracking, same events as mobile |
| Geolocation | Browser Geolocation API | HTML5 GPS access with permission prompt |
| Notifications | Firebase Cloud Messaging | Push via service worker (PWA) |

**Key capability**: Passengers can register, book rides, track drivers, and pay entirely through the browser without installing the mobile app.

### Landing Page
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 + Vite (or plain HTML) | Lightweight, SEO-friendly |
| Styling | Tailwind CSS | Modern, fast design |
| Content | Static + API-driven | Download links, driver count, live city stats |

**Purpose**:
- Marketing / brand presence for TriQ
- App download links (Google Play, App Store badges)
- "Use Web Version" button for passengers who prefer not to install
- Driver recruitment CTA ("Become a TriQ Driver")
- City coverage info (Digos City zones, landmarks)

### Web Admin Dashboard
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | React 18 + Vite | Fast builds, modern dev experience |
| Styling | Tailwind CSS | Utility-first, rapid UI development |
| UI Components | shadcn/ui | Accessible, unstyled primitives |
| Maps | Leaflet.js + OSM | Free, lightweight |
| Charts | Recharts | Ride analytics, earnings dashboards |

### Backend API
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js 20+ LTS | Mature ecosystem, async I/O for real-time |
| Framework | Express.js + TypeScript | Minimal, fast, typed |
| ORM | Prisma | Type-safe queries, migrations, schema management |
| Validation | Zod | Runtime type safety + API contract |
| Real-time | Socket.io | Rooms per ride, driver location broadcast |
| File Uploads | Multer + Sharp | Driver docs, profile photos |
| Logging | Pino | Fast, structured JSON logs |
| Gamification | Background jobs + PostgreSQL aggregates | Badge auto-award triggers, leaderboard recalculation |
| Scheduler | node-cron | Daily/weekly leaderboard reset, badge checks |

### Database
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Primary DB | PostgreSQL 16 | ACID, relational integrity, geospatial support |
| Geospatial | PostGIS Extension | `ST_DWithin`, KNN queries for nearby drivers |
| ORM | Prisma | Migration engine, type generation |
| Cache & Sessions | Redis 7 | Fast KV, pub/sub, geospatial fallback if needed |

### Maps & Location (All Free)
| Service | Technology | Purpose |
|---------|-----------|---------|
| Map Tiles | OpenStreetMap (OSM) | Display maps, no API key |
| Geocoding | Nominatim (self-hosted or public) | Address → Lat/Lng, Lng/Lat → Address |
| Distance / Routing | Haversine Formula | Straight-line distance for fare estimation |
| Future Routing | Self-hosted OSRM | Accurate road-distance routing (optional) |

### Authentication
| Service | Technology | Purpose |
|---------|-----------|---------|
| Identity | Firebase Auth | Phone number OTP, free tier 50k users/mo |
| Token Refresh | Custom JWT (Node.js) | API session tokens |
| Push Notifications | Firebase Cloud Messaging | Free, reliable delivery |

### Payments (Philippines)
| Service | Technology | Purpose |
|---------|-----------|---------|
| Payment Gateway | PayMongo | GCash, Maya, Cards, GrabPay |
| Subscriptions | PayMongo Checkout / Links | Driver subscription billing |
| Platform Tips | PayMongo Payment Intents | Optional passenger tips to TriQ platform |

### Infrastructure
| Layer | Technology | Rationale |
|-------|-----------|-----------|
| VPS OS | Ubuntu Server 24.04 LTS amd64 | Standard x86_64, best Node/Docker support |
| Containerization | Docker + Docker Compose | Isolated services, reproducible deploys |
| Reverse Proxy | Nginx | SSL termination, rate limiting, static files |
| SSL | Let's Encrypt (Certbot) | Free HTTPS certificates |
| Process Manager | PM2 (fallback) or Docker | Keep API alive, log rotation |

## Communication Patterns

### REST API
- Standard CRUD operations
- JWT Bearer token authentication
- Rate limiting via Nginx / Express middleware

### Socket.io Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `driver:location` | Driver → Server | Broadcast GPS coordinates every 3-5s |
| `ride:request` | Passenger → Server | New ride request broadcast to nearby drivers |
| `ride:offer` | Driver → Server | Driver accepts a ride |
| `ride:status` | Server → Both | Status updates (accepted, arriving, started, completed) |
| `ride:location` | Server → Passenger | Stream driver's live location |
| `passenger:cancel` | Passenger → Server | Cancel before pickup |
| `driver:cancel` | Driver → Server | Cancel after acceptance |

## Security & Safety / KYC

### Authentication & Authorization
- HTTPS only (HSTS headers)
- JWT short-lived access tokens + refresh tokens
- Input validation via Zod on every endpoint
- SQL injection protection via Prisma parameterized queries
- Firebase Auth phone verification prevents fake accounts
- Rate limiting on OTP sends, login attempts

### KYC & Identity Verification
- **Driver KYC is mandatory** before going online — franchise, license, OR/CR, selfie, vehicle photo
- **Passenger KYC is gating** — browse mode allowed, but `POST /rides` requires `kycStatus === 'VERIFIED'`
- Document uploads stored in isolated S3/VPS folder with hashed filenames
- Admin review queue for all KYC submissions (driver + passenger)
- Rejection reasons logged with admin ID for audit trail
- Annual re-verification check (franchise / license expiry)

### Data Protection
- Phone numbers masked in logs and non-admin APIs
- Driver exact home address never exposed to passengers
- Passenger pickup/dropoff only shared with assigned driver
- Profile photos resized + compressed before storage (Sharp)
- Document photos encrypted at rest (future)

### Ride Safety
- Both parties see each other's verified name + photo before ride starts
- Real-time ride status visible to admin dashboard
- One-tap emergency contact/share ride details button
- Ride cancellation reason required (data for safety analysis)
- Admin can forcibly cancel any active ride and alert both parties

### Compliance
- LGU franchise verification ensures only legitimate tricycle operators
- KYC records retained per Philippine data retention laws
- Admin audit log for all document approvals/rejections
