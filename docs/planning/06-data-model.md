# TriQ — Data Model & Database Schema

**Database:** PostgreSQL + PostGIS  
**ORM:** Prisma

---

## Entity Overview

| Entity | Purpose |
|--------|---------|
| `User` | Firebase-authenticated account (phone + UID) |
| `Passenger` | Rider profile, KYC status, saved places |
| `Driver` | Operator profile, KYC status, subscription, live location |
| `Subscription` | PayMongo subscription record (tier, status, expiry) |
| `Ride` | Ride request from pickup to dropoff |
| `RideStatus` | Audit log of every status change |
| `Tip` | Optional platform tip from passenger to TriQ |
| `Review` | Post-ride rating + comment |
| `Document` | KYC upload (driver or passenger — license, franchise, ID, selfie) |
| `SavedPlace` | Passenger's favorite locations |
| `Badge` | Master list of achievable badges/achievements |
| `DriverBadge` | Junction: which driver earned which badge and when |
| `DriverPoints` | Driver points log (computed + manual entries) |
| `PassengerBadge` | Junction: which passenger earned which badge and when |
| `PassengerPoints` | Passenger points log (computed + manual entries) |
| `SeasonalChallenge` | Time-limited leaderboard events |
| `Report` | Safety/incident report (passenger→driver or driver→passenger) |
| `ReportAttachment` | Photo/video attached to a report |

---

## Prisma Schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql", url = env("DATABASE_URL") }

enum UserRole { PASSENGER DRIVER OWNER STAFF }
enum KycStatus { UNVERIFIED PENDING_REVIEW VERIFIED REJECTED }
enum DriverStatus { PENDING VERIFIED SUSPENDED }
enum SubscriptionTier { FREE PRO ELITE }
enum SubscriptionStatus { PENDING ACTIVE EXPIRED CANCELLED }
enum RideStatusEnum { REQUESTED ACCEPTED ARRIVING STARTED COMPLETED CANCELLED COUNTER_OFFERED COUNTER_OFFER_ACCEPTED COUNTER_OFFER_REJECTED COUNTER_OFFER_EXPIRED }
enum PaymentMethod { CASH GCASH MAYA CARD }
enum DocumentType {
  // Driver documents
  DRIVER_LICENSE
  TRICYCLE_FRANCHISE
  VEHICLE_ORCR
  DRIVER_SELFIE
  VEHICLE_PHOTO
  // Passenger documents
  PASSENGER_ID
  PASSENGER_SELFIE
}
enum DocumentStatus { PENDING APPROVED REJECTED }

model User {
  id          String   @id @default(uuid())
  firebaseUid String   @unique
  phoneNumber String   @unique
  role        UserRole @default(PASSENGER)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  passenger   Passenger?
  driver      Driver?
  auditLogs   AuditLog[] // admin actions taken by this user
}

model Passenger {
  id            String   @id @default(uuid())
  userId        String   @unique
  name          String
  photoUrl      String?
  homeLocation  String?
  workLocation  String?
  emergencyContact String?
  kycStatus     KycStatus @default(UNVERIFIED)
  kycReviewedAt DateTime?
  kycReviewedBy String?  // admin userId
  kycRejectionReason String?

  // Booking responsibility scoring
  trustScore        Int      @default(100) // 0-100; decremented on auto-cancel, no-show, excessive cancellation
  autoCancelledCount Int     @default(0)   // number of times a booking was auto-cancelled by system

  user          User     @relation(fields: [userId], references: [id])
  rides         Ride[]   @relation("PassengerRides")
  savedPlaces   SavedPlace[]
  platformTips  Tip[]    @relation("TipFrom") // passenger → platform tips
  reviewsGiven  Review[] @relation("ReviewFrom")
  feedbackReceived PassengerFeedback[] @relation("FeedbackTo")
  documents     Document[]
  badges        PassengerBadge[]
  points        PassengerPoints[]
  strikes       Strike[]
  devices       Device[]
  notificationPreferences NotificationPreference?
  emergencyEvents EmergencyEvent[] // as reporter
}

model Driver {
  id                String   @id @default(uuid())
  userId            String   @unique
  name              String
  photoUrl          String?
  plateNumber       String   @unique
  tricycleModel     String?
  status            DriverStatus @default(PENDING)
  isOnline          Boolean  @default(false)
  currentLat        Float?
  currentLng        Float?
  lastLocationAt    DateTime?
  pickupRadius      Int      @default(2000) // max pickup distance in meters (500-5000)
  expandedRadiusUntil DateTime? // temporary radius expansion expiry
  subscriptionTier  SubscriptionTier @default(FREE)
  subscriptionStatus SubscriptionStatus @default(ACTIVE)
  subscriptionExpiresAt DateTime?

  // Driver stats (computed on ride completion)
  totalEarnings     Int      @default(0) // centavos (estimated fares)
  totalRides        Int      @default(0)
  rating            Float    @default(5.0)
  reviewCount       Int      @default(0)

  user              User          @relation(fields: [userId], references: [id])
  rides             Ride[]        @relation("DriverRides")
  documents         Document[]
  subscriptions     Subscription[]
  // Note: Tips go to platform, not driver. No driver tip relation.
  reviewsReceived   Review[]      @relation("ReviewTo")
  feedbackGiven     PassengerFeedback[] @relation("FeedbackFrom")
  badges            DriverBadge[]
  points            DriverPoints[]
  devices           Device[]
  notificationPreferences NotificationPreference?
  emergencyEvents   EmergencyEvent[] // as responder
}

model Subscription {
  id        String   @id @default(uuid())
  driverId  String
  tier      SubscriptionTier
  status    SubscriptionStatus @default(ACTIVE)
  isTrial   Boolean  @default(false) // true for free 7-day Pro trial
  trialEndsAt DateTime? // set for trial; null after trial converts to paid
  paymongoId String?   // PayMongo checkout/session ID
  amount    Int      // Amount in centavos (0 for trial)
  startedAt DateTime @default(now())
  expiresAt DateTime
  cancelledAt DateTime?

  driver    Driver   @relation(fields: [driverId], references: [id])
}

model Ride {
  id              String   @id @default(uuid())
  passengerId     String
  driverId        String?

  pickupLat       Float
  pickupLng       Float
  pickupAddress   String
  dropoffLat      Float
  dropoffLng      Float
  dropoffAddress  String

  status          RideStatusEnum @default(REQUESTED)
  estimatedFare   Int      // in centavos — platform-calculated, shown to both parties
  finalFare       Int?     // in centavos — driver may optionally enter actual cash collected for personal records

  // Ride details (passenger-provided before booking)
  passengerCount  Int      @default(1)       // number of passengers
  hasSeniorCitizen Boolean @default(false)
  hasStudent      Boolean  @default(false)
  hasExtraBaggage Boolean  @default(false)

  // Counter-offer negotiation
  counterOfferedFare Int?   // driver proposed fare in centavos
  counterOfferStatus String? // PENDING, ACCEPTED, REJECTED, EXPIRED
  counterOfferExpiresAt DateTime? // 5-minute expiry from counter-offer
  counterOfferDriverId String? // driver who made the counter-offer
  negotiatedFare  Int?     // final agreed fare in centavos (if counter-offer accepted)

  paymentMethod   PaymentMethod @default(CASH)

  preferredDriverId String? // rebook: only this driver can see/accept (subscription perk)

  passenger       Passenger @relation("PassengerRides", fields: [passengerId], references: [id])
  driver          Driver?   @relation("DriverRides", fields: [driverId], references: [id])
  statusHistory   RideStatus[]
  tip             Tip?
  review          Review?
  passengerFeedback PassengerFeedback?
  reports         Report[]
  emergencyEvents EmergencyEvent[]
  strike          Strike?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?
}

model RideStatus {
  id        String   @id @default(uuid())
  rideId    String
  status    RideStatusEnum
  lat       Float?
  lng       Float?
  note      String?
  actor     String   @default("USER") // USER, DRIVER, PASSENGER, SYSTEM
  createdAt DateTime @default(now())

  ride      Ride     @relation(fields: [rideId], references: [id])
}

model Tip {
  id            String   @id @default(uuid())
  rideId        String?  @unique  // optional — standalone tips don't need a ride
  passengerId   String?           // optional — who sent the tip
  driverId      String?           // optional — driver being tipped (platform tip, not driver payout)
  amount        Int      // in centavos
  paymongoId    String?  // PayMongo payment_intent_id for webhook matching
  status        String   @default("PENDING") // PENDING, PAID, FAILED
  createdAt     DateTime @default(now())
  paidAt        DateTime?

  ride          Ride?      @relation(fields: [rideId], references: [id])
  passenger     Passenger? @relation("TipFrom", fields: [passengerId], references: [id])
  driver        Driver?    @relation("TipFromDriver", fields: [driverId], references: [id])
  // Note: Tips go to the platform (TriQ), not to the driver
}

model Review {
  id          String   @id @default(uuid())
  rideId      String   @unique
  reviewerId  String   // passengerId
  revieweeId  String   // driverId
  rating      Int      // 1-5
  thumbsUp    Boolean? // true = thumbs up, false = thumbs down, null = no binary feedback
  comment     String?
  createdAt   DateTime @default(now())

  ride        Ride     @relation(fields: [rideId], references: [id])
  reviewer    Passenger @relation("ReviewFrom", fields: [reviewerId], references: [id])
  reviewee    Driver    @relation("ReviewTo", fields: [revieweeId], references: [id])
}

model PassengerFeedback {
  id              String   @id @default(uuid())
  rideId          String   @unique
  fromDriverId    String
  toPassengerId   String
  thumbsUp        Boolean  // true = thumbs up, false = thumbs down
  comment         String?
  createdAt       DateTime @default(now())

  ride            Ride      @relation(fields: [rideId], references: [id])
  from            Driver    @relation("FeedbackFrom", fields: [fromDriverId], references: [id])
  to              Passenger @relation("FeedbackTo", fields: [toPassengerId], references: [id])
}

model Document {
  id          String   @id @default(uuid())
  driverId    String?
  passengerId String?
  type        DocumentType
  url         String
  status      DocumentStatus @default(PENDING)
  reviewedBy  String?  // admin userId
  reviewedAt  DateTime?
  createdAt   DateTime @default(now())

  driver      Driver?   @relation(fields: [driverId], references: [id])
  passenger   Passenger? @relation(fields: [passengerId], references: [id])
}

model SavedPlace {
  id        String   @id @default(uuid())
  passengerId String
  name      String
  address   String
  lat       Float
  lng       Float

  passenger Passenger @relation(fields: [passengerId], references: [id])
}

model Badge {
  id          String   @id @default(uuid())
  code        String   @unique  // e.g., "FIRST_RIDE", "CENTURY_CLUB"
  name        String           // e.g., "First Ride"
  description String
  iconUrl     String?
  tier        String   @default("BRONZE") // BRONZE, SILVER, GOLD, ELITE
  condition   String?          // Human-readable unlock condition
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  drivers     DriverBadge[]
  passengers  PassengerBadge[]
}

model DriverBadge {
  id        String   @id @default(uuid())
  driverId  String
  badgeId   String
  earnedAt  DateTime @default(now())

  driver    Driver   @relation(fields: [driverId], references: [id])
  badge     Badge    @relation(fields: [badgeId], references: [id])

  @@unique([driverId, badgeId])
}

model DriverPoints {
  id        String   @id @default(uuid())
  driverId  String
  points    Int      // Can be positive (earned) or negative (rare penalty)
  reason    String   // e.g., "RIDE_COMPLETED", "5_STAR_RATING", "DAY_ONLINE"
  rideId    String?  // Optional link to ride
  createdAt DateTime @default(now())

  driver    Driver   @relation(fields: [driverId], references: [id])
}

model PassengerBadge {
  id        String   @id @default(uuid())
  passengerId String
  badgeId   String
  earnedAt  DateTime @default(now())

  passenger Passenger @relation(fields: [passengerId], references: [id])
  badge     Badge    @relation(fields: [badgeId], references: [id])

  @@unique([passengerId, badgeId])
}

model PassengerPoints {
  id        String   @id @default(uuid())
  passengerId String
  points    Int      // Can be positive or negative
  reason    String   // e.g., "RIDE_COMPLETED", "PLATFORM_TIP_SENT", "5_STAR_GIVEN", "THUMBS_UP_RECEIVED"
  rideId    String?  // Optional link to ride
  createdAt DateTime @default(now())

  passenger Passenger @relation(fields: [passengerId], references: [id])
}

model SeasonalChallenge {
  id          String   @id @default(uuid())
  name        String   // e.g., "Kadayawan Festival Challenge"
  description String
  startDate   DateTime
  endDate     DateTime
  metric      String   // "RIDES", "EARNINGS", "RATING", "PLATFORM_TIPS"
  prizeTier   String   // "PRO_1WEEK", "PRO_1MONTH", "CASH_500"
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Report {
  id            String   @id @default(uuid())
  rideId        String
  reporterId    String   // userId of reporter
  reportedId    String   // userId of reported party
  reporterRole  UserRole // PASSENGER or DRIVER
  reportedRole  UserRole // DRIVER or PASSENGER
  category      String   // e.g., "UNSAFE_DRIVING", "OVERCHARGING", "NO_SHOW", "ABUSIVE_BEHAVIOR"
  severity      String   @default("MEDIUM") // LOW, MEDIUM, HIGH, CRITICAL
  description   String?
  status        String   @default("PENDING") // PENDING, INVESTIGATING, RESOLVED, DISMISSED
  resolutionNote String?
  reviewedBy    String?  // admin userId
  reviewedAt    DateTime?
  createdAt     DateTime @default(now())

  ride          Ride     @relation(fields: [rideId], references: [id])
  attachments   ReportAttachment[]
}

model ReportAttachment {
  id          String   @id @default(uuid())
  reportId    String
  url         String
  mimeType    String   // image/jpeg, video/mp4, etc.
  createdAt   DateTime @default(now())

  report      Report   @relation(fields: [reportId], references: [id])
}

model Strike {
  id          String   @id @default(uuid())
  passengerId String
  rideId      String   @unique
  reason      String   // NO_SHOW, ABUSIVE_BEHAVIOR, LATE_CANCELLATION
  issuedBy    String   // SYSTEM or admin userId
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  expiresAt   DateTime? // auto-expire after 30 days

  passenger   Passenger @relation(fields: [passengerId], references: [id])
  ride        Ride     @relation(fields: [rideId], references: [id])
}

model AuditLog {
  id          String   @id @default(uuid())
  adminId     String
  action      String   // IMPERSONATION_START, KYC_APPROVE, DRIVER_SUSPEND, etc.
  targetType  String   // PASSENGER, DRIVER, RIDE, REPORT, etc.
  targetId    String
  reason      String?
  metadata    Json?    // flexible context
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  admin       User     @relation(fields: [adminId], references: [id])
}

model City {
  id          String   @id @default(uuid())
  name        String   // "Digos City"
  country     String   // "Philippines"
  province    String   // "Davao del Sur"
  lat         Float    // city center latitude
  lng         Float    // city center longitude
  isActive    Boolean  @default(true) // city available for bookings
  createdAt   DateTime @default(now())

  fareRates   FareRate[]
}

model FareRate {
  id          String   @id @default(uuid())
  cityId      String
  baseFare    Int      // in centavos (e.g., 1600 for ₱16)
  perKmRate   Int      // in centavos (e.g., 1000 for ₱10)
  maxDistance Int      // in km (e.g., 10)
  minDistance Int      // in km (e.g., 1)
  effectiveFrom DateTime @default(now())
  effectiveUntil DateTime?

  city        City     @relation(fields: [cityId], references: [id])
}

model SystemConfig {
  id          String   @id @default(uuid())
  key         String   @unique // MAINTENANCE_MODE, PASSENGER_BOOKING_ENABLED, etc.
  value       String   // "true", "false", "2026-01-01", etc.
  description String?
  updatedAt   DateTime @updatedAt
  updatedBy   String?  // admin userId
}

model EmergencyEvent {
  id          String   @id @default(uuid())
  rideId      String
  reporterId  String   // passenger userId
  responderId String?  // driver userId (if during ride)
  lat         Float?
  lng         Float?
  alertType   String   // ADMIN_EMAIL, ADMIN_SMS, EMERGENCY_CONTACT
  status      String   @default("ACTIVE") // ACTIVE, RESOLVED, FALSE_ALARM
  resolvedAt  DateTime?
  resolvedBy  String?  // admin userId
  notes       String?
  createdAt   DateTime @default(now())

  ride        Ride     @relation(fields: [rideId], references: [id])
}

model Device {
  id          String   @id @default(uuid())
  userId      String
  passengerId String?
  driverId    String?
  fingerprint String   @unique // device fingerprint hash
  brand       String?
  model       String?
  os          String?  // Android 14, iOS 17
  appVersion  String?
  lastSeenAt  DateTime @updatedAt
  isTrusted   Boolean  @default(true)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])
  passenger   Passenger? @relation(fields: [passengerId], references: [id])
  driver      Driver?  @relation(fields: [driverId], references: [id])
}

model NotificationPreference {
  id                String   @id @default(uuid())
  userId            String   @unique
  passengerId       String?  @unique
  driverId          String?  @unique
  pushEnabled       Boolean  @default(true)
  smsEnabled        Boolean  @default(true)
  emailEnabled      Boolean  @default(false)
  marketingEnabled  Boolean  @default(true)
  rideUpdatesEnabled Boolean @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  passenger         Passenger? @relation(fields: [passengerId], references: [id])
  driver            Driver?  @relation(fields: [driverId], references: [id])
}
```

---

## Key Design Decisions

1. **Firebase UID stored in `User`** — Firebase is source of truth for auth; our DB mirrors it.
2. **`currentLat` / `currentLng` on `Driver`** — Quick lookup for nearby driver queries. Purged on logout.
3. **All monetary values in `Int` centavos** — Avoids float rounding errors (₱100.50 = `10050`).
4. **`RideStatus` separate table** — Full audit trail; regulators or disputes require this.
5. **`Document.reviewedBy` stores `userId`** — Admin who approved/rejected; accountability.
6. **PostGIS not shown in Prisma schema** — Enabled via migration/raw SQL for geospatial indexes on `Driver.currentLat/Lng` and `Ride.pickupLat/Lng`.
7. **Single `Document` model for both passenger and driver KYC** — `driverId` and `passengerId` are optional; one will be set per record. Keeps schema DRY.
8. **`KycStatus` on `Passenger`** — Gates ride booking at API level (`kycStatus === 'VERIFIED'` required). Browse mode allows `UNVERIFIED` and `PENDING_REVIEW`.
9. **`Driver.status` renamed from enum to prevent confusion** — `PENDING` = awaiting KYC review; `VERIFIED` = approved, can go online; `SUSPENDED` = banned.
10. **`DriverPoints` log table** — Immutable append-only log. Leaderboard rankings computed via aggregation query (`SUM(points)` grouped by driver + time window). No pre-computed rank column to avoid staleness.
11. **`Badge` master table** — Admin-configurable. New badges can be added without code changes. `code` field used by backend trigger logic to auto-award.
12. **`DriverBadge` junction with `@@unique([driverId, badgeId])`** — Prevents duplicate badge awards. Same badge cannot be earned twice.
13. **`PassengerBadge` junction with `@@unique([passengerId, badgeId])`** — Same pattern for passengers. Points and badges are symmetric across both user types.
14. **`Review.thumbsUp` as `Boolean?`** — Optional ternary: `true` = thumbs up, `false` = thumbs down, `null` = no binary feedback given. Allows star-only ratings while supporting quick feedback.
15. **Unified `Report` model for both directions** — `reporterRole` and `reportedRole` clarify direction (passenger→driver or driver→passenger). Same table, same admin queue, same workflow.
16. **`ReportAttachment` separate table** — Supports multiple photos/videos per report. `mimeType` allows client-side preview validation.
17. **Passenger gamification mirrors driver gamification** — Same table patterns (`PassengerBadge`, `PassengerPoints`) for consistency. Leaderboard queries aggregate from both point tables separately.
18. **`Ride.estimatedFare` and `Ride.finalFare`** — `estimatedFare` is computed by platform (distance × rate). `finalFare` is optional — driver can optionally record actual cash collected for personal earnings audit. Platform never handles the cash.
19. **Driver earnings audit is computed, not stored** — Daily/weekly/monthly earnings views are aggregation queries over `Ride` table filtered by `driverId` + `completedAt` + `status = COMPLETED`. No separate `Earnings` table needed.
20. **`Strike` entity** — Core to no-escrow fake ride protection. Auto-expires after 30 days to give passengers a clean slate. `isActive` flag allows admin to override.
21. **`AuditLog` entity** — Immutable record of every admin action. `metadata` JSON field allows flexible context without schema migrations. Required for impersonation accountability.
22. **`City` + `FareRate` entities** — Fare rates are per-city and versioned (`effectiveFrom`/`effectiveUntil`). Allows rate changes without breaking historical ride records.
23. **`SystemConfig` entity** — Key-value store for feature flags and app-wide settings. No code deploy needed to toggle maintenance mode or enable/disable features.
24. **`EmergencyEvent` entity** — Safety audit trail. Links to ride, reporter, and optional responder. Status tracked through resolution lifecycle.
25. **`Device` entity** — Fraud detection signal. `fingerprint` is a hashed device identifier. `isTrusted` can be toggled if suspicious activity detected.
26. **`NotificationPreference` entity** — Per-user opt-in/opt-out for push, SMS, email, marketing, and ride-specific updates. Separate from auth to allow anonymous preference storage.

## PostGIS Indexes (Migration)

```sql
-- Add geometry columns via raw migration
SELECT AddGeometryColumn('Driver', 'location', 4326, 'POINT', 2);
SELECT AddGeometryColumn('Ride', 'pickupPoint', 4326, 'POINT', 2);

-- Create spatial indexes
CREATE INDEX idx_driver_location ON Driver USING GIST(location);
CREATE INDEX idx_ride_pickup ON Ride USING GIST(pickupPoint);

-- Nearby driver query (example)
SELECT d.id, d.name, d.plateNumber
FROM Driver d
WHERE ST_DWithin(
  d.location,
  ST_SetSRID(ST_MakePoint(125.3573, 6.7500), 4326),  -- Digos City center
  3000  -- 3km radius
)
AND d.isOnline = true
AND d.status = 'VERIFIED'
ORDER BY ST_Distance(d.location, ST_SetSRID(ST_MakePoint(125.3573, 6.7500), 4326))
LIMIT 10;
```
