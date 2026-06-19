# TriQ — Challenges, Security Hardening, QoL & Deep Analysis

## 1. Known Challenges & Proposed Solutions

### Challenge 1: Network Connectivity (Budget Smartphones + Slow Internet)
**Context**: Many tricycle drivers and passengers in Digos City use budget Android phones with limited data plans and intermittent connectivity.

**Problems**:
- GPS updates drop during rides
- Ride requests fail mid-transaction
- Socket.io disconnections on weak signal
- App crashes on low-RAM devices

**Solutions**:
- **Offline-first architecture**: Cache map tiles, driver locations, and ride state locally
- **Background sync queue**: Failed API calls retry automatically when connection returns
- **Socket.io reconnection with exponential backoff**: Reconnect silently, replay missed events
- **Optimistic UI**: Show "Request sent" immediately; confirm server-side async
- **Low-bandwidth mode**: Toggle to reduce map detail, disable animations, compress images
- **SMS fallback**: Critical ride status (driver accepted, arrived) sent via SMS if push fails
- **App size optimization**: Tree-shake dependencies; target <15MB APK

---

### Challenge 2: GPS Inaccuracy in Dense/Urban Areas
**Context**: Digos City has narrow streets, sari-sari stores, and dense housing that block GPS signals.

**Problems**:
- Driver appears 50-100m away from actual location
- Passenger sets wrong pickup pin
- Fare estimate incorrect due to GPS drift

**Solutions**:
- **GPS smoothing + Kalman filtering**: Backend filters noisy GPS streams
- **Geofenced landmarks**: Pre-defined pickup points ("near Jollibee Digos", "City Hall terminal", "Gaisano Mall")
- **Pin confirmation**: Passenger confirms exact spot via photo or description before booking
- **Driver "I have arrived" button with auto-correction**: Driver's arrival updates passenger's pickup point to actual GPS
- **Haversine + buffer zone**: Search radius includes 100m uncertainty buffer

---

### Challenge 3: Fraud & Abuse — The No-Escrow Problem
**Context**: TriQ does **not hold passenger or driver money**. Ride fares are cash-only, paid directly. This means there is **no financial deposit to forfeit** as a deterrent against fake rides.

**Why This Is Critical**:
- On escrow platforms (Grab, Uber), fake rides cost the passenger a cancellation fee — deterrent built-in
- On TriQ, a fake ride costs the passenger **nothing financially** — only the driver's time and fuel are wasted
- Without strong non-financial deterrents, the platform becomes vulnerable to trolling and abuse

**Threats**:
- **Fake ride requests** to troll drivers (no-show passengers)
- **Driver-passenger collusion** (fake rides to farm points/badges/leaderboard rank)
- **Multiple accounts per person** (driver creates fake passenger accounts to boost ratings)
- **Ghost accepting** (driver accepts then never shows, hoping for cancellation points)
- **Chargeback fraud** on platform tips (Passenger disputes GCash charge after tipping)
- **Location spoofing** (GPS faker apps)

**Solutions — Strike-Based Deterrent (No Escrow)**:
- **5-strike system** for both passengers and drivers, escalating from warning → 24h ban → 7d ban → 30d ban → permanent deactivation
- **Ride validation**: Minimum distance (≥200m) + minimum time (≥2 min) before ride counts as "completed" for points/badges
- **GPS proximity validation**: Backend checks driver is within 100m of pickup before "Arrived" status allowed
- **Cancellation tracking**: Free cancellation within 2 min; after that, reason required. Pattern analysis flags repeat offenders.
- **Driver cancellation rate monitoring**: >20% cancellation rate triggers automatic review
- **Accept timeout**: 15-second auto-decline prevents "ghost accepting"
- **KYC gate**: Only verified users can book (real identity = accountability)
- **Device fingerprinting**: Track device ID; prevent one device from being both driver and passenger
- **Anomaly detection**: Flag impossible ride frequency (e.g., 50 rides/hour)
- **Review weighting**: Verified KYC users' reviews weighted higher; new/unverified accounts have reduced impact
- **Location spoofing detection**: Server-side velocity check (impossible to travel 5km in 1 minute)
- **Collusion detection**: Graph analysis — same passenger→driver pairs repeating unusually often
- **Matching penalty**: Bad actors (recent strikes) deprioritized in search results for both sides
- **Leaderboard disqualification**: Any strike in a period = ineligible for that period's leaderboard prizes
- **Points deduction**: Fake ride = -50 passenger points / -100 driver points
- **Tip velocity limits**: Max 1 platform tip per ride; max ₱100/day per passenger to prevent rapid-fire abuse or testing stolen cards
- **Admin fraud dashboard**: Auto-flag suspicious patterns for manual review

**Why Strikes Work Without Escrow**:
- Real reputation damage (visible to other party before accepting ride)
- Loss of gamification benefits (leaderboard, badges, points)
- Loss of platform access (bans)
- KYC means real identity is tied to account — hard to recreate

---

### Challenge 4: Driver Availability Imbalance
**Context**: Peak hours (morning rush, market day, rain) create driver shortages. Off-peak hours leave drivers idle.

**Problems**:
- Passengers wait too long during peaks
- Drivers earn too little during off-peak
- Subscription revenue drops if drivers don't see value

**Solutions**:
- **Dynamic heatmap**: Show passengers where demand is highest; show drivers where passengers are waiting
- **Off-peak incentive points**: Double points for rides during 10 AM - 3 PM (low demand)
- **Scheduled rides (Phase 2)**: Passengers book 15-60 min ahead; drivers plan routes
- **Push notifications to idle drivers**: "High demand near Digos Public Market — go online?"
- **Subscription value guarantee (Phase 3)**: If Pro driver gets <X rides/week, auto-extend subscription

---

### Challenge 5: Regulatory / LGU Compliance
**Context**: Tricycles in the Philippines are regulated by LGU (Local Government Unit). Franchise certificates are issued by Digos City.

**Problems**:
- LGU may view TriQ as competing with terminal dispatchers
- Franchise requirements change; some drivers operate without valid franchise
- Barangay tanods or traffic enforcers may question app-based hailing

**Solutions**:
- **Franchise verification is mandatory**: No valid franchise = no online status
- **LGU partnership outreach (Phase 3)**: Offer data dashboard to Digos City transport office
- **Complement, don't replace terminals**: Allow terminal-based drivers to also use app
- **Transparent fare display**: Prevents overcharging complaints to LGU
- **KYC records retained**: Ready for LGU audit if requested

---

### Challenge 6: Scaling Beyond Digos City
**Context**: If TriQ succeeds, expansion to nearby cities (Davao City, Kidapawan, General Santos) is natural.

**Problems**:
- Fare rates differ per city
- Different LGU franchise requirements
- Database load increases with more drivers/passengers
- Single VPS becomes bottleneck

**Solutions**:
- **City-scoped data**: Add `City` table; all rides, drivers, rates scoped by city
- **Read replicas**: PostgreSQL read replicas for leaderboard/analytics queries
- **Redis Cluster**: For geospatial lookups across multiple cities
- **CDN for static assets**: Nginx + Cloudflare (free tier) for landing page and app updates
- **Horizontal scaling blueprint**: Docker Swarm or Kubernetes migration path documented

---

## 2. Security Hardening

### API Security
| Layer | Implementation | Purpose |
|-------|---------------|---------|
| **Rate Limiting** | Express `express-rate-limit` + Redis store | 100 req/min per IP; 5 req/min for auth endpoints |
| **CORS** | Whitelist only `triq.app`, `localhost` dev | Prevent cross-origin abuse |
| **Helmet.js** | Security headers (CSP, HSTS, X-Frame-Options) | OWASP baseline protection |
| **Input Sanitization** | Zod validation on every endpoint | No SQL injection, XSS, or malformed data |
| **JWT Security** | RS256 (asymmetric) signing; 15-min access tokens | Stolen tokens expire quickly; private key never leaves server |
| **Refresh Token Rotation** | Single-use refresh tokens stored in Redis | Prevents refresh token replay attacks |
| **API Versioning** | `/api/v1/` prefix | Breaking changes without breaking existing app installs |

### Container & Infrastructure Security
| Layer | Implementation | Purpose |
|-------|---------------|---------|
| **Non-root containers** | Docker `USER` directive | API container runs as `node`, not `root` |
| **Read-only filesystem** | Docker `read_only: true` + tmpfs for `/tmp` | Immutable containers; attackers can't modify app code |
| **Secrets management** | `.env` file on VPS, never in Git | Database passwords, JWT keys, Firebase credentials isolated |
| **Network isolation** | Docker internal network; Postgres/Redis not exposed to internet | Only Nginx + API accessible externally |
| **Fail2Ban** | Auto-ban IPs with repeated 401/403 responses | Brute-force protection |
| **Automatic security updates** | `unattended-upgrades` on Ubuntu | OS-level CVE patches |
| **Docker image scanning** | `docker scan` or Trivy CI step | Catch vulnerabilities in base images |

### Data Security
| Layer | Implementation | Purpose |
|-------|---------------|---------|
| **Database encryption** | PostgreSQL `sslmode=require` + LUKS disk encryption | Data at rest protected |
| **Phone number masking** | Last 4 digits only in non-admin APIs | Privacy protection |
| **Document photo access** | Signed URLs with 5-minute expiry | Prevent direct linking to KYC photos |
| **Audit logging** | Every admin action logged to immutable table | Accountability; regulator requests |
| **GDPR/Data Privacy Act compliance** | Right to data export; right to deletion (soft delete) | Philippine Data Privacy Act of 2012 compliance |

---

## 3. Quality of Life (QoL) Features

### Passenger QoL
| Feature | Description | Phase |
|---------|-------------|-------|
| **Estimated Wait Time** | Real-time ETA based on nearest driver distance + traffic | MVP |
| **Favorite Drivers** | "Request this driver again" — passenger can favorite a driver | Phase 2 |
| **Multi-stop Ride** | Add 1-2 waypoints before final destination | Phase 2 |
| **Scheduled Ride** | Book 15-60 minutes in advance | Phase 2 |
| **Fare Breakdown Transparency** | Show base fare + distance + time breakdown | MVP |
| **Ride Reminder** | Push notification 5 min before scheduled ride | Phase 2 |
| **Auto-complete Addresses** | Cached frequent addresses; barangay shortcuts | MVP |
| **Weather-aware ETA** | Rain = longer estimated wait (manual adjustment) | Phase 2 |
| **Group Ride Split** | Multiple passengers split fare (one pays, others reimburse) | Phase 3 |

### Driver QoL
| Feature | Description | Phase |
|---------|-------------|-------|
| **Auto-accept mode** | Accept nearest ride automatically if idle >5 min | Phase 2 |
| **Destination filter** | Only show ride requests going toward driver's preferred direction | Phase 2 |
| **Break mode** | "Pause" status — visible as offline but quick resume | Phase 2 |
| **Earnings goal tracker** | Set daily/weekly target; progress bar + celebration on hit | Phase 2 |
| **Passenger notes** | Driver can add private notes about passenger (e.g., "tips well") | Phase 2 |
| **Navigation hints** | Turn-by-turn text directions to pickup (no map needed, saves data) | MVP |
| **Low-battery warning** | Alert driver when phone battery <20% while online | Phase 2 |

### Admin QoL
| Feature | Description | Phase |
|---------|-------------|-------|
| **One-click mass notification** | Broadcast to all drivers/passengers in a city | MVP |
| **Data export (CSV/Excel)** | Rides, earnings, KYC data exportable | Phase 2 |
| **System health dashboard** | API uptime, DB connections, Redis memory, Docker status | Phase 2 |
| **Admin role levels** | Super Admin (full) vs Support Admin (KYC review only) vs Finance Admin (payments only) | Phase 2 |
| **Bulk KYC actions** | Approve/reject multiple drivers at once | Phase 2 |

---

## 4. Advanced Admin Controls

### System Configuration
- **City management**: Add/remove cities, set city-specific base fares, per-km rates
- **Zone editor**: Draw Digos City zones on map; set zone-based pricing
- **Dynamic fare multiplier**: Rainy day = 1.2x, holiday = 1.5x (with driver notification)
- **Maintenance mode**: Toggle "TriQ is under maintenance" banner; prevent new bookings
- **Feature flags**: Enable/disable features per city or globally (e.g., disable tipping temporarily)

### User Management
- **Impersonation**: Admin can log in as any driver/passenger (for support, with audit log)
- **Soft delete**: Deactivate user without deleting data (compliant with Data Privacy Act)
- **Mass suspension**: Bulk suspend drivers/passengers by criteria (e.g., all with expired franchise)
- **Whitelist/blacklist**: Barangay-level or street-level service area control

### Analytics & Business Intelligence
- **Retention funnel**: Signup → KYC → First Ride → Repeat Ride → 30-day retention
- **Cohort analysis**: Drivers who joined in January vs March — survival curves
- **Churn prediction**: ML model (simple logistic regression) flags drivers likely to quit
- **Peak heatmap**: Historical demand by hour-of-day and day-of-week per barangay
- **Driver lifetime value (LTV)**: Estimated total earnings + subscription value per driver
- **Customer acquisition cost (CAC)**: Track marketing spend per new active user

---

## 5. System Resilience & Observability

### Health Checks
```
GET /health         → API + DB + Redis connectivity
GET /health/deep    → Include PostGIS query latency, Socket.io room count
GET /health/ready   → Kubernetes-style readiness probe
```

### Logging Strategy
| Level | Example | Destination |
|-------|---------|-------------|
| `ERROR` | Database connection failed, PayMongo webhook failed | Pino JSON → file → `docker logs` |
| `WARN` | Rate limit hit, suspicious login attempt | Same as above |
| `INFO` | Ride completed, driver went online, KYC approved | Same as above |
| `DEBUG` | SQL query timing, Socket.io event payload | Dev only; disabled in production |

### Alerting (Phase 2+)
| Condition | Alert Method | Severity |
|-----------|-------------|----------|
| API 500 errors > 5 in 5 min | Email to admin | Critical |
| Postgres connection pool > 80% | Email + SMS | High |
| Redis memory > 90% | Email | Medium |
| SSL cert expires in < 7 days | Email | Medium |
| VPS disk > 85% | Email | Medium |

### Graceful Degradation
- **If PostGIS is slow**: Fall back to Haversine distance (less accurate but works)
- **If Redis is down**: Use in-memory cache for 5 min; disable leaderboards temporarily
- **If Firebase Auth is down**: Cached JWT validation continues for 24 hours; block new registrations
- **If PayMongo is down**: Disable tipping UI; subscriptions continue; retry webhooks later
- **If Nominatim is down**: Use cached address suggestions; allow manual address entry

---

## 6. Data Retention & Privacy Compliance

### Philippine Data Privacy Act of 2012 Compliance
| Data Type | Retention Period | Action After |
|-----------|-----------------|-------------|
| Ride history | 3 years | Anonymize (remove passenger/driver IDs, keep aggregate stats) |
| KYC documents | Duration of account + 2 years | Soft delete; purge after legal hold cleared |
| Chat/report logs | 2 years | Anonymize |
| GPS location history | 90 days | Purge; keep only last known location |
| Push notification tokens | Until logout/uninstall | Remove on token refresh failure |
| Audit logs | 5 years | Archive to cold storage |

### User Rights (to implement)
- **Right to Access**: Export all personal data (GDPR Article 15 style)
- **Right to Rectification**: Update profile, request KYC re-review
- **Right to Erasure**: Account deletion request → 30-day grace → soft delete → purge after retention period
- **Right to Data Portability**: Export ride history as CSV

---

## 7. Growth & Viral Mechanics

### Referral System
- **Passenger referral**: "Share TriQ, get ₱20 off your next ride" when referred friend completes first ride
- **Driver referral**: "Refer a driver, get ₱100 when they complete 10 rides"
- **Referral tracking**: Unique referral code per user; tracked in `Referral` table

### Onboarding Optimization
- **Progressive onboarding**: Show map first, then auth, then KYC — reduce drop-off
- **Guest browsing**: View app without phone number for 60 seconds (like e-commerce)
- **Driver onboarding checklist**: Visual progress bar through KYC steps
- **First ride incentive**: Passenger gets ₱10 off first ride; driver gets bonus points for first completed ride

---

## 8. Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| VPS downtime (hardware failure) | Low | Critical | Daily backups; documented restore procedure; hot standby planned |
| Data breach (KYC photos leaked) | Low | Critical | Encrypted storage; signed URLs; access logging; no public URLs |
| Fake ride abuse (no escrow deterrent) | High | High | 5-strike system; KYC gate; GPS validation; collusion detection; matching penalties |
| Driver strike / boycott (subscription fees) | Low | Medium | Free tier always available; gamification rewards offset cost |
| LGU shutdown order | Low | Critical | Compliance-first design; LGU partnership outreach |
| Competitor launch (Grab trike, Angkas-style) | Medium | High | Digos-first loyalty; driver community; subscription lock-in |
| Firebase pricing change | Low | Medium | Auth abstraction layer; easy migration path to custom OTP |
| PayMongo outage | Medium | Medium | Graceful disable of tipping; subscription retry logic |
