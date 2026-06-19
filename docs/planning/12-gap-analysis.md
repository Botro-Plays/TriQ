# TriQ — Gap Analysis: Features vs Model vs Reality

## 1. Features Missing Model Support

### A. Strike System
| Feature | Status | Gap |
|---------|--------|-----|
| 5-strike system for passengers & drivers | Defined in `05-features.md` | **No `Strike` entity** in `06-data-model.md` |
| Strike detail view (GPS data, cancellation timing) | Admin feature | Cannot store without Strike table |
| Override strikes, appeals workflow | Admin feature | Needs `Strike` + `StrikeAppeal` tables |
| Auto-escalation rules | Admin config | Needs `StrikeRule` config table |

**Required additions**:
```prisma
model Strike {
  id            String   @id @default(uuid())
  userId        String   // who got the strike
  userRole      UserRole // PASSENGER or DRIVER
  rideId        String?  // which ride triggered it
  level         Int      // 1-5
  reason        String   // NO_SHOW, LATE_CANCEL, etc.
  triggeredAt   DateTime @default(now())
  expiresAt     DateTime? // 24h, 7d, 30d strikes expire
  isActive      Boolean  @default(true)
  overriddenBy  String?  // admin userId
  overrideNote  String?
}
```

---

### B. Consecutive Days Tracking
| Feature | Status | Gap |
|---------|--------|-----|
| "Perfect Week" badge (7 consecutive days with ride) | Driver badge | **No `DriverStreak` or `PassengerStreak` entity** |
| "Loyal Rider" badge (30 consecutive days) | Passenger badge | Streak broken logic needs daily tracking |
| "Consecutive login days" points | Driver points | Login events not tracked separately |
| "Consecutive booking days" leaderboard | Passenger leaderboard | Needs daily booking flag per user |

**Required additions**:
```prisma
model UserStreak {
  id            String   @id @default(uuid())
  userId        String
  userRole      UserRole
  streakType    String   // "RIDE_DAYS", "LOGIN_DAYS", "BOOKING_DAYS"
  currentStreak Int      @default(0)
  longestStreak Int      @default(0)
  lastDate      DateTime? // last day streak was active
}
```

---

### C. Emergency System
| Feature | Status | Gap |
|---------|--------|-----|
| Emergency button during active ride | Both apps | **No `EmergencyEvent` entity** |
| Emergency response log in admin | Admin dashboard | Cannot query without table |
| Auto-dial emergency contact | Driver/Passenger app | Phone number source unclear |

**Required additions**:
```prisma
model EmergencyEvent {
  id          String   @id @default(uuid())
  rideId      String
  triggeredBy String   // userId
  role        UserRole
  type        String   // "POLICE", "EMERGENCY_CONTACT", "BARANGAY"
  location    Json?    // { lat, lng } at time of press
  createdAt   DateTime @default(now())
}
```

---

### D. Ride Sharing / Live Links
| Feature | Status | Gap |
|---------|--------|-----|
| "Share ride details" — send live ride link | Both apps | **No `ShareLink` or `RideShare` entity** |
| Trusted contact receives live tracking | Passenger app | Link expiry, revocation not modeled |

**Required additions**:
```prisma
model RideShare {
  id          String   @id @default(uuid())
  rideId      String
  sharedBy    String   // passengerId
  token       String   @unique // URL-safe share token
  expiresAt   DateTime // auto-expire when ride completes + 1 hour
  isRevoked   Boolean  @default(false)
}
```

---

### E. Device Fingerprinting
| Feature | Status | Gap |
|---------|--------|-----|
| One device = one account prevention | Fraud prevention | **No `Device` entity** |
| Device ID tracking | Security | Needed for multi-account detection |

**Required additions**:
```prisma
model Device {
  id          String   @id @default(uuid())
  fingerprint String   @unique // hashed device ID
  userId      String
  userRole    UserRole
  userAgent   String?
  lastSeenAt  DateTime @default(now())
}
```

---

### F. Fare Rates & Zones
| Feature | Status | Gap |
|---------|--------|-----|
| Fare rate configuration (base fare, per km) | Admin settings | **No `FareRate` entity** |
| Zone-based pricing | Admin zone editor | **No `Zone` entity** |
| City-specific rates | Multi-city future | **No `City` entity** |
| Digos City zones | Map features | Geofence polygons not modeled |

**Required additions**:
```prisma
model City {
  id          String   @id @default(uuid())
  name        String   // "Digos City"
  code        String   @unique // "DIGOS"
  isActive    Boolean  @default(true)
  baseFare    Int      // in centavos
  perKmRate   Int      // in centavos
  zones       Zone[]
}

model Zone {
  id          String   @id @default(uuid())
  cityId      String
  name        String   // "Poblacion", "Matti", etc.
  multiplier  Float    @default(1.0) // 1.0 = normal, 1.2 = peak
  // PostGIS polygon for zone boundary
}
```

---

### G. Admin Audit Log
| Feature | Status | Gap |
|---------|--------|-----|
| Admin action audit log | Security/QoL | **No `AuditLog` entity** |
| Impersonation logging | API spec | Every admin action needs audit trail |
| KYC approval audit | Already mentioned | Not formally modeled |

**Required additions**:
```prisma
model AuditLog {
  id          String   @id @default(uuid())
  adminId     String
  action      String   // "KYC_APPROVE", "STRIKE_OVERRIDE", "IMPERSONATE_START"
  targetType  String   // "DRIVER", "PASSENGER", "RIDE", "CONFIG"
  targetId    String?
  oldValue    Json?    // before state
  newValue    Json?    // after state
  reason      String?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
}
```

---

### H. System Configuration / Feature Flags
| Feature | Status | Gap |
|---------|--------|-----|
| Browse mode toggle | App config | **No `SystemConfig` entity** |
| KYC requirement toggle | App config | Needs key-value config store |
| Gamification master switch | App config | Needs key-value config store |
| Maintenance mode | App config | Needs key-value config store |
| Fare rate editor | Admin | Rates live in `City` table (see above) |

**Required additions**:
```prisma
model SystemConfig {
  id    String @id @default(uuid())
  key   String @unique // "BROWSE_MODE_ENABLED", "KYC_REQUIRED", etc.
  value String   // stored as string, parsed by app
  updatedAt DateTime @updatedAt
  updatedBy String? // admin userId
}
```

---

### I. Notifications
| Feature | Status | Gap |
|---------|--------|-----|
| Notification preferences (passenger & driver) | Settings | **No `NotificationPreference` entity** |
| Notification templates (SMS, push) | Admin | Templates in `Settings` but not modeled |
| System announcements | Admin broadcast | **No `Announcement` entity** |

**Required additions**:
```prisma
model NotificationPreference {
  id            String   @id @default(uuid())
  userId        String
  pushEnabled   Boolean  @default(true)
  smsEnabled    Boolean  @default(false)
  rideUpdates   Boolean  @default(true)
  promotions    Boolean  @default(true)
  gamification  Boolean  @default(true)
}

model Announcement {
  id          String   @id @default(uuid())
  title       String
  body        String
  targetRole  UserRole? // null = all
  sentAt      DateTime @default(now())
  expiresAt   DateTime?
}
```

---

### J. Referral System
| Feature | Status | Gap |
|---------|--------|-----|
| Passenger referral ("Share TriQ, get P20 off") | Growth | **No `Referral` entity** |
| Driver referral | Growth | Needs tracking table |
| Unique referral codes | Growth | Per-user code generation |

**Required additions**:
```prisma
model Referral {
  id          String   @id @default(uuid())
  referrerId  String   // who shared
  referredId  String?  // who signed up (nullable until they do)
  code        String   @unique
  status      String   @default("PENDING") // PENDING, COMPLETED, REWARDED
  rewardAmount Int?    // in centavos
  createdAt   DateTime @default(now())
}
```

---

## 2. Data Model Entities Without Feature Counterparts

| Entity | In Model? | Feature Counterpart? | Gap |
|--------|-----------|---------------------|-----|
| `RideStatus` | Yes (audit log) | Partially — status timeline shown | Full status history viewer in admin missing |
| `ReportAttachment` | Yes | Photo/video attachment for reports | Yes, but admin "Report detail view" mentions attachments — OK |
| `SeasonalChallenge` | Yes | Admin can create challenges | **No driver/passenger UI for viewing active challenges** |
| `Document` | Yes | KYC upload | OK |

**Note**: `SeasonalChallenge` exists in model but features doc only mentions admin creating them — no passenger/driver view of "your active challenges" or progress.

---

## 3. Practical Inapplicability Issues

### A. Selfie with ID — Implementation Complexity
**Feature**: "Selfie verification (liveness check — hold ID next to face)"
**Reality**: This requires:
- ML-based face comparison (Firebase ML Kit or AWS Rekognition)
- OR manual admin comparison (very slow, error-prone)
- **Missing**: Which service? What's the fallback if ML fails?

**Recommendation**: Start with **manual admin review** (side-by-side comparison tool in admin). ML face match is Phase 2.

---

### B. "Consecutive 5-star ratings" Badge — Ambiguous
**Feature**: "5-Star Streak — 10 consecutive 5-star ratings" (driver) / "5-Star Giver — 20 consecutive 5-star ratings" (passenger)
**Reality**: What does "consecutive" mean?
- Consecutive rides? (If driver gets 4 stars on ride #5, streak resets to 0?)
- Consecutive in time? (Every ride must be 5 stars, no breaks?)
- What if a passenger doesn't rate? (Does that break the streak?)

**Recommendation**: Define as "last N ratings received were all 5 stars" — missing ratings are ignored, only rated rides count.

---

### C. Driver Earnings "Actual Fare" Field — Trust Issue
**Feature**: Driver optionally enters actual cash collected
**Reality**: Why would a driver accurately report this?
- Tax reporting incentive (some might, many won't)
- If inaccurate, all earnings analytics become unreliable
- **Missing**: Incentive for accurate entry

**Recommendation**: Make it **optional with no penalty**. Label clearly: "For your personal records only. Optional."

---

### D. Emergency Button Auto-Dial — False Alarms
**Feature**: One-tap emergency call
**Reality**: 
- Accidental presses will happen
- Who pays for the call? (Passenger's load)
- What number? 911 (Philippines has a patchy emergency response), local barangay tanod?

**Recommendation**: 
- Add **3-second hold** to prevent accidental presses
- Default to **emergency contact** (passenger/driver configured), not 911
- Allow configuration of emergency number

---

### E. "Driver View: Passenger Leaderboards" — Privacy Concern
**Feature**: Driver sees passenger badges and rank in ride request
**Reality**:
- Passengers may not want drivers knowing their ride frequency
- Could enable targeting (drivers preferring frequent riders)
- **GDPR/Data Privacy Act risk**: Usage data exposed to third party

**Recommendation**: 
- Show only **anonymized tier** (e.g., "Frequent Rider" vs "New Rider")
- Never show exact ride count or rank number to driver
- Admin analytics can show full data, but driver view is limited

---

### F. Weekly Leaderboard Rewards — Free Pro for 1 Month
**Feature**: Weekly top-3 get free Pro for 1 month
**Reality**:
- If a driver wins every week, they never pay for Pro
- Subscription revenue cannibalization
- **Missing**: Win limit (e.g., max 1 free month per quarter)

**Recommendation**: Add "can only win free Pro once per month" rule.

---

### G. Device Fingerprinting — Bypassable
**Feature**: One device = prevent being both driver and passenger
**Reality**:
- Device IDs can be spoofed on Android (rooted phones)
- Multiple cheap phones cost ~P1,500 — affordable for fraud
- Firebase Auth allows multiple accounts per phone (different numbers)

**Recommendation**: 
- Device fingerprint is **one signal among many**, not absolute
- Combine with: IP address, behavior pattern, KYC identity cross-check

---

### H. GPS Proximity Validation (100m for "Arrived")
**Feature**: Backend checks driver is within 100m before allowing "Arrived"
**Reality**:
- GPS accuracy in Digos City dense areas can be 50-200m
- A driver legitimately at pickup might be rejected due to GPS drift
- **Frustration**: Driver can't mark arrived, passenger waits

**Recommendation**: 
- Use **200m buffer** in urban/dense areas
- Allow driver to override with photo confirmation ("I'm here, GPS is wrong")
- Log overrides for fraud pattern detection

---

### I. Free Cancellation < 2 Minutes — Abuse Vector
**Feature**: Free cancellation within 2 min of request
**Reality**:
- Passenger can request → cancel → request → cancel repeatedly
- Each cancellation creates a ride record in DB
- Driver sees request, starts moving, then cancellation
- **Missing**: Rate limit on cancellations per hour

**Recommendation**: Max 3 free cancellations per hour per passenger.

---

### J. Platform Tips P1–P20 — PayMongo Minimum
**Feature**: Tips as low as P1
**Reality**:
- PayMongo has a **minimum transaction fee** (~P6-10 fixed + percentage)
- A P1 tip would cost the platform money (fee > tip amount)
- **Economically infeasible**

**Recommendation**: 
- Minimum tip: **P10** (or absorb fees for P5-9 as marketing cost)
- Or: accumulate tips and batch charge (e.g., "Tip P50 total" after 5 rides)

---

## 4. Inconsistencies Between Documents

### A. KYC Document Types
| Feature | Model | Issue |
|---------|-------|-------|
| "Selfie holding ID" | `PASSENGER_SELFIE` | Is this one photo (selfie + ID together) or two separate photos? |
| "Vehicle inspection photo" | `VEHICLE_PHOTO` | Feature says "front, side, plate clearly visible" — one photo or three? |

**Fix needed**: Clarify in features doc that selfie + ID is **one combined photo**, vehicle is **minimum one photo** (admin may request more).

---

### B. Subscription Free Trial
| Monetization | Features | Gap |
|--------------|----------|-----|
| "Free Trial (7 days Pro)" | "Subscriptions in Phase 2" | **No `Trial` entity** in data model; no mention of trial in admin dashboard |

**Fix needed**: Add `Trial` tracking or extend `Subscription` model with `isTrial` flag.

---

### C. Admin Role Levels
| Architecture | Features | Gap |
|--------------|----------|-----|
| "Super Admin / Support Admin / Finance Admin" mentioned in QoL | No role enum in data model beyond `ADMIN` | **No role-based permissions** modeled |

**Fix needed**: Extend `UserRole` or add separate `AdminRole` enum.

---

### D. Fare Estimate Formula
| Features | API Spec | Gap |
|----------|----------|-----|
| "Haversine distance × rate per km" | "baseFare + (distanceKm × perKmRate)" | Features doc says "×" (multiply distance by rate) but doesn't mention base fare clearly; API doc says "base + distance × rate" |

**Fix needed**: Features doc should state clearly: "Estimated fare = base fare + (distance in km × per-km rate)"

---

### E. "Priority Booking" as Passenger Reward
| Gamification | Monetization | Gap |
|--------------|------------|-----|
| "Free priority booking for 1 week" (passenger leaderboard reward) | "Priority Booking" listed as future revenue stream (P5-10) | Is priority booking a **paid feature** or a **free reward**? Both docs treat it differently. |

**Fix needed**: Clarify — Phase 2: free as reward only. Phase 3+: may become paid feature. Currently: reward only.

---

### F. Tip Velocity Limits
| Security | API Spec | Gap |
|----------|----------|-----|
| "Max 1 platform tip per ride; max P100/day" | Tip schema allows `amount: 1-2000` (P1-P20) | Schema enforces per-tip max but not per-day aggregate. API rate limit says "1 per ride" but no daily cap enforcement. |

**Fix needed**: Add backend daily tip aggregate check in API implementation.

---

## 5. Summary: Critical Additions Needed

### Must Have (Blocks MVP)
1. **`Strike` entity** — Fake ride protection is core to no-escrow model
2. **`AuditLog` entity** — Admin accountability, KYC audit, impersonation
3. **`City` + `FareRate` entity** — Fare calculation needs configurable rates
4. **`SystemConfig` entity** — Feature flags, maintenance mode
5. **Clarify "Free cancellation < 2 min" rate limit** — Add max 3/hour rule

### Should Have (Phase 1)
6. **`UserStreak` entity** — Consecutive days badges
7. **`EmergencyEvent` entity** — Safety feature
8. **`RideShare` entity** — Share live ride link
9. **`NotificationPreference` entity** — Settings feature
10. **`Device` entity** — Fraud detection signal

### Nice to Have (Phase 2+)
11. **`Zone` entity** — Zone-based pricing
12. **`Referral` entity** — Growth mechanics
13. **`Announcement` entity** — System broadcasts
14. **`Trial` tracking** — Free trial subscription
15. **PayMongo minimum tip analysis** — Validate P1 tip economics

---

## 7. Resolved Items (This Session)

| # | Issue | Resolution | Files Updated |
|---|-------|------------|---------------|
| 1 | **Fare formula** — Haversine vs road distance | Changed to **OSRM road distance**, base fare ₱16 | `05-features.md`, `08-api-spec.md` |
| 2 | **KYC selfie** — one combined photo? | Clarified as **3 separate photos**: selfie + front ID + back ID | `05-features.md` |
| 3 | **Priority booking** — paid vs free reward | **Free reward only** for top positive feedback + completion rate passengers; may become paid in Phase 3 | `05-features.md`, `03-monetization.md` |
| 4 | **Consecutive 5-star badges** — ambiguous definition | **Removed entirely** — not practical since users don't always rate immediately | `05-features.md` |
| 5 | **Emergency button** — 911 default, false alarms | Changed to: **3-second hold** → primary: **silent admin alert (email/SMS)**; fallback: configured emergency contact; option: barangay tanod | `05-features.md` |
| 6 | **Booking constraints** — cancellation abuse | **Only 1 pending booking per passenger** (409 Conflict if trying to book again); **driver cannot accept if has active/pending ride**; cancellation free only if no driver accepted yet | `05-features.md`, `08-api-spec.md` |
| 7 | **GPS proximity buffer** — 100m too tight | Changed to **200m buffer** + **photo confirmation override** if GPS inaccurate; admin reviews flagged overrides | `05-features.md`, `08-api-spec.md` |
| 8 | **Admin roles** — Super/Support/Finance Admin | Simplified to: **OWNER** (single, full access) + **STAFF** (limited access) | `06-data-model.md`, `08-api-spec.md` |
| 9 | **Free trial gap** — no tracking entity | Added `isTrial Boolean` + `trialEndsAt DateTime?` to `Subscription` model; trial amount = 0 centavos | `06-data-model.md`, `03-monetization.md` |
| 10 | **PayMongo minimum tip** — P1 economically infeasible? | **Confirmed: PayMongo accepts ₱1** — no change to tip amounts (₱1–₱20) | `12-gap-analysis.md` (documented as acceptable) |
| 11 | **Fare fallback** — OSRM failure | **Default to ₱16** for rides within 2.5km straight-line; Haversine × 1.3 factor for rides >2.5km | `05-features.md`, `08-api-spec.md` |
| 12 | **Driver haggling reality** — drivers negotiate, especially for pickup distance | **Documented**: estimate is LGU guideline only; actual payment is between parties; passengers can report overcharging; pickup distance shown to driver with warning | `05-features.md` |
| 13 | **Driver protection vs fake bookings** — far-away requests waste fuel/time | **Configurable pickup radius** (default 2km, range 500m–5km); driver can temporarily expand; pickup distance shown in request popup; long pickup shows warning | `05-features.md`, `06-data-model.md`, `08-api-spec.md` |
| 14 | **Negotiation/haggling** — drivers need to charge for pickup distance | **Counter-offer flow**: Driver proposes fare (with reason); passenger accepts/rejects within 5 min; if accepted, `negotiatedFare` is set; ride proceeds at agreed fare | `05-features.md`, `06-data-model.md`, `08-api-spec.md` |
| 15 | **Ride capacity/details** — tricycle capacity varies | **Passenger inputs**: passenger count (max 6 — Digos City standard), senior/student flags (LGU discount), extra baggage flag (warns driver) | `05-features.md`, `06-data-model.md`, `08-api-spec.md` |
| 16 | **Driver needs to clarify before accepting** — pickup location ambiguity | **"Call passenger" button** in request popup (BEFORE accept) — direct phone call for clarification | `05-features.md` |
| 17 | **Ghost bookings** — passengers leave bookings pending for hours | **Gradual auto-cancel**: 30-min reconfirmation prompt, 60-min second prompt, 90-min auto-cancel if ignored. First 2 auto-cancels in 7 days: **no penalty** (driver supply issue). 3rd+ in 7 days: **-5 trustScore** (repeat ghost-booker). Warning banner at <70, 24h booking cooldown at <50 | `05-features.md`, `06-data-model.md`, `08-api-spec.md` |
| 18 | **Fare estimate** — not accounting for passenger count or LGU discounts | **Per-pax pricing**: base ₱16 + distance = per person; total = perPersonFare × passengerCount; **20% LGU discount** if senior/student; optional pickup distance fee (flat, once per ride, not per pax) | `05-features.md`, `08-api-spec.md` |

---

## 6. Quick-Win Fixes (Text-Only)

These require no model changes — just doc clarifications:

| Issue | Document | Fix |
|-------|----------|-----|
| ~~Fare formula ambiguity~~ | ~~`05-features.md`~~ | ~~Resolved: OSRM road distance + base ₱16~~ |
| ~~Selfie + ID = one photo?~~ | ~~`05-features.md`~~ | ~~Resolved: 3 separate photos~~ |
| ~~Priority booking dual meaning~~ | ~~`03-monetization.md` + `05-features.md`~~ | ~~Resolved: free reward for top feedback + completion rate~~ |
| ~~"Consecutive 5-star" definition~~ | ~~`05-features.md`~~ | ~~Resolved: badge removed entirely~~ |
| ~~Emergency number default~~ | ~~`05-features.md`~~ | ~~Resolved: admin alert primary, contact fallback~~ |
| ~~Free cancellation abuse~~ | ~~`05-features.md`~~ | ~~Resolved: 1 pending booking max; cancellation free only if no driver accepted~~ |
| ~~GPS 100m buffer may be tight~~ | ~~`05-features.md`~~ | ~~Resolved: 200m buffer + photo override~~ |
