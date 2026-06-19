# TriQ — API Specification & Event Protocol

## Base URL

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:4000/api/v1` |
| Staging | `https://staging.triq.app/api/v1` |
| Production | `https://triq.app/api/v1` |

---

## Authentication

### 1. Firebase Phone OTP (Client-side)
```
POST /auth/verify-phone
Body: { phoneNumber: "+63917xxxxxxx", firebaseIdToken: "<JWT from Firebase>" }
Response: { userId, firebaseUid, token: "<custom JWT>", refreshToken }
```

### 2. Custom JWT (API Access)
- Issued by Node.js backend after Firebase verification
- Algorithm: **RS256** (asymmetric)
- Access token TTL: **15 minutes**
- Refresh token TTL: **7 days** (single-use, stored in Redis)
- Header: `Authorization: Bearer <access_token>`

### 3. Refresh Token
```
POST /auth/refresh
Body: { refreshToken }
Response: { token: "<new access_token>", refreshToken: "<new refresh_token>" }
```

### 4. Logout
```
POST /auth/logout
Headers: Authorization: Bearer <token>
Body: { refreshToken }
Response: 204 No Content
```

---

## Standard Response Format

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "phoneNumber", "message": "Invalid Philippine mobile number" }
    ]
  }
}
```

### Error Codes
| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Valid token, insufficient role |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## REST Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/verify-phone` | No | Verify Firebase token, issue custom JWT |
| `POST` | `/auth/refresh` | No | Exchange refresh token for new access token |
| `POST` | `/auth/logout` | Yes | Revoke refresh token |

### Users (Passengers & Drivers)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me` | Yes | Get current user profile |
| `PATCH` | `/users/me` | Yes | Update own profile |
| `POST` | `/users/me/photo` | Yes | Upload profile photo |
| `DELETE` | `/users/me/photo` | Yes | Remove profile photo |

### Passengers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/passengers/me` | Yes | Get passenger profile |
| `PATCH` | `/passengers/me` | Yes | Update passenger profile |
| `POST` | `/passengers/me/kyc` | Yes | Submit KYC documents |
| `GET` | `/passengers/me/kyc/status` | Yes | Check KYC status |
| `GET` | `/passengers/me/saved-places` | Yes | List saved places |
| `POST` | `/passengers/me/saved-places` | Yes | Add saved place |
| `DELETE` | `/passengers/me/saved-places/:id` | Yes | Remove saved place |
| `GET` | `/passengers/me/rides` | Yes | Ride history |
| `GET` | `/passengers/me/points` | Yes | Current points total |
| `GET` | `/passengers/me/badges` | Yes | Earned badges |
| `GET` | `/passengers/me/strikes` | Yes | Active strikes |

### Drivers
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/drivers/me` | Yes | Get driver profile |
| `PATCH` | `/drivers/me` | Yes | Update driver profile |
| `POST` | `/drivers/me/kyc` | Yes | Submit KYC documents |
| `GET` | `/drivers/me/kyc/status` | Yes | Check KYC status |
| `POST` | `/drivers/me/online` | Yes | Go online (broadcast availability) |
| `POST` | `/drivers/me/offline` | Yes | Go offline |
| `PATCH` | `/drivers/me/location` | Yes | Update current GPS location |
| `GET` | `/drivers/me/rides` | Yes | Completed rides (earnings audit) |
| `GET` | `/drivers/me/earnings` | Yes | Aggregated earnings (daily/weekly/monthly) |
| `POST` | `/drivers/me/earnings/:rideId` | Yes | Record actual fare for a ride |
| `GET` | `/drivers/me/subscription` | Yes | Current subscription status |
| `POST` | `/drivers/me/subscription` | Yes | Create subscription (PayMongo checkout) |
| `GET` | `/drivers/me/points` | Yes | Current points total |
| `GET` | `/drivers/me/badges` | Yes | Earned badges |
| `GET` | `/drivers/me/strikes` | Yes | Active strikes |
| `PATCH` | `/drivers/me/pickup-radius` | Yes | Set max pickup distance (meters). Default: 2000 (2km). Range: 500–5000 |
| `POST` | `/drivers/me/expand-radius` | Yes | Temporarily expand search radius (e.g., 5km for 15 min) |

### Rides
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/rides` | Yes (KYC) | Create ride request (with ride details: pax, senior, student, baggage) |
| `GET` | `/rides/:id` | Yes | Get ride details |
| `POST` | `/rides/:id/accept` | Yes (Driver) | Driver accepts ride (original estimated fare) |
| `POST` | `/rides/:id/counter-offer` | Yes (Driver) | Driver proposes different fare (pickup distance rationale) |
| `POST` | `/rides/:id/counter-offer/accept` | Yes (Passenger) | Passenger accepts counter-offer (ride proceeds at agreed fare) |
| `POST` | `/rides/:id/counter-offer/reject` | Yes (Passenger) | Passenger rejects counter-offer (ride back to REQUESTED for others) |
| `POST` | `/rides/:id/decline` | Yes (Driver) | Driver declines ride |
| `POST` | `/rides/:id/arrived` | Yes (Driver) | Driver arrived at pickup |
| `POST` | `/rides/:id/start` | Yes (Driver) | Start ride (passenger boarded) |
| `POST` | `/rides/:id/complete` | Yes (Driver) | Complete ride |
| `POST` | `/rides/:id/cancel` | Yes | Cancel ride (passenger or driver) |
| `POST` | `/rides/:id/rate` | Yes (Passenger) | Rate driver |
| `POST` | `/rides/:id/thumbs` | Yes | Thumbs up/down the other party |
| `POST` | `/rides/:id/report` | Yes | Report the other party |
| `POST` | `/rides/:id/tip` | Yes (Passenger) | Platform tip (₱1–₱20) |
| `GET` | `/rides/active` | Yes | Get current active ride (if any) |

### Nearby Drivers (Geospatial)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/drivers/nearby` | Yes | Find nearby online drivers |

Query params:
- `lat` (float): Passenger latitude
- `lng` (float): Passenger longitude
- `radius` (int, default=3000): Search radius in meters (max 5000)

Response:
```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "id": "uuid",
        "name": "Juan Dela Cruz",
        "photoUrl": "...",
        "plateNumber": "ABC-123",
        "rating": 4.8,
        "subscriptionTier": "ELITE",
        "badges": ["First Ride", "Century Club"],
        "distance": 450, // meters
        "currentLat": 6.7500,
        "currentLng": 125.3573,
        "estimatedArrivalMinutes": 3
      }
    ]
  }
}
```

### Leaderboards
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/leaderboards/drivers` | Yes | Driver leaderboard |
| `GET` | `/leaderboards/passengers` | Yes | Passenger leaderboard |

Query params:
- `period` (string): `week` | `month` | `alltime`
- `metric` (string): `rides` | `earnings` | `rating` | `tips` (passenger) / `consecutive_days` (driver)
- `page` (int, default=1)
- `limit` (int, default=20, max=100)

### Gamification
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/badges` | Yes | List all available badges |
| `GET` | `/badges/me` | Yes | My earned badges |
| `GET` | `/challenges/active` | Yes | Active seasonal challenges |

### Admin Endpoints (require `OWNER` or `STAFF` role; `OWNER` has full access, `STAFF` has limited access)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/admin/dashboard` | Overview stats |
| `GET` | `/admin/drivers` | List all drivers (filter, paginate) |
| `GET` | `/admin/drivers/:id` | Driver detail view |
| `PATCH` | `/admin/drivers/:id` | Edit driver profile |
| `POST` | `/admin/drivers/:id/suspend` | Suspend driver |
| `POST` | `/admin/drivers/:id/reactivate` | Reactivate driver |
| `POST` | `/admin/drivers/:id/impersonate` | Issue impersonation token |
| `GET` | `/admin/passengers` | List all passengers |
| `GET` | `/admin/passengers/:id` | Passenger detail view |
| `PATCH` | `/admin/passengers/:id` | Edit passenger profile |
| `POST` | `/admin/passengers/:id/suspend` | Suspend passenger |
| `POST` | `/admin/passengers/:id/reactivate` | Reactivate passenger |
| `POST` | `/admin/passengers/:id/impersonate` | Issue impersonation token |
| `GET` | `/admin/kyc/drivers` | Driver KYC queue |
| `GET` | `/admin/kyc/passengers` | Passenger KYC queue |
| `POST` | `/admin/kyc/:id/approve` | Approve KYC |
| `POST` | `/admin/kyc/:id/reject` | Reject KYC with reason |
| `GET` | `/admin/rides` | All rides list (search/filter) |
| `GET` | `/admin/rides/:id` | Ride detail |
| `POST` | `/admin/rides/:id/cancel` | Force-cancel ride |
| `GET` | `/admin/reports` | Report queue |
| `GET` | `/admin/reports/:id` | Report detail |
| `POST` | `/admin/reports/:id/investigate` | Mark investigating |
| `POST` | `/admin/reports/:id/resolve` | Resolve report |
| `POST` | `/admin/reports/:id/dismiss` | Dismiss report |
| `GET` | `/admin/strikes` | Strike queue (passengers + drivers) |
| `POST` | `/admin/strikes/:id/override` | Override strike |
| `GET` | `/admin/ratings` | All ratings |
| `POST` | `/admin/ratings/:id/hide` | Hide rating |
| `GET` | `/admin/subscriptions` | Subscription revenue report |
| `GET` | `/admin/tips` | Platform tip transaction log |
| `GET` | `/admin/earnings` | Aggregate earnings audit |
| `GET` | `/admin/leaderboards` | Leaderboard viewer |
| `POST` | `/admin/leaderboards/:id/reward` | Assign leaderboard prize |
| `GET` | `/admin/analytics` | System analytics |
| `GET` | `/admin/audit-log` | Admin action audit log |
| `GET` | `/admin/config` | Current app configuration |
| `PATCH` | `/admin/config` | Update app configuration |
| `GET` | `/admin/health` | API health metrics |

---

## Socket.io Event Protocol

### Connection
- Client connects with JWT in auth header
- Server validates JWT, joins user-specific room
- Server sends `connection:ack` with `userId`, `role`

### Rooms
| Room | Pattern | Purpose |
|------|---------|---------|
| `user:{userId}` | Per-user | Private notifications |
| `ride:{rideId}` | Per-ride | Real-time ride updates |
| `city:digos` | Per-city | Broadcasts (maintenance, announcements) |
| `owner` | Owner-only | Owner real-time events (sensitive: payments, impersonation) |
| `staff` | Staff-only | Staff real-time events (KYC queue, reports, rides) |

### Events: Driver → Server

#### `driver:location`
```json
{
  "lat": 6.7500,
  "lng": 125.3573,
  "heading": 180,
  "speed": 25
}
```
- Emitted every 3-5 seconds while online and in active ride
- Server broadcasts to `ride:{rideId}` room

#### `driver:online`
```json
{ "lat": 6.7500, "lng": 125.3573 }
```
- Driver marks self available for ride requests
- Server adds to PostGIS active drivers index

#### `driver:offline`
```json
{}
```
- Driver stops receiving ride requests
- Server removes from PostGIS, clears `currentLat/Lng`

#### `driver:ride:accept`
```json
{ "rideId": "uuid", "driverId": "uuid" }
```
- Driver accepts a ride request at original estimated fare
- Server validates driver is nearby and has no active/pending ride (returns 409 Conflict if so)

#### `driver:ride:counter-offer`
```json
{ "rideId": "uuid", "proposedFare": 2500, "reason": "Pickup distance 2.3km" }
```
- Driver proposes a different fare (e.g., to cover long pickup distance)
- Server sets ride status to `COUNTER_OFFERED`, counterOfferStatus = PENDING
- Server sends push notification to passenger
- Counter-offer expires in 5 minutes; if expired, ride returns to REQUESTED

#### `passenger:ride:counter-offer:accept`
```json
{ "rideId": "uuid" }
```
- Passenger accepts driver's counter-offer
- Server updates ride status to `COUNTER_OFFER_ACCEPTED`, sets `negotiatedFare`
- Server notifies driver; ride proceeds normally from here

#### `passenger:ride:counter-offer:reject`
```json
{ "rideId": "uuid" }
```
- Passenger rejects counter-offer
- Server clears counter-offer fields, ride returns to `REQUESTED` for other drivers
- Server notifies driver of rejection

#### `driver:ride:arrived`
```json
{ "rideId": "uuid" }
```
- Driver arrived at pickup
- Server validates GPS within 200m of pickup (200m buffer for urban GPS drift)
- If GPS shows >200m, driver can upload photo confirmation; admin reviews if flagged

#### `driver:ride:started`
```json
{ "rideId": "uuid" }
```
- Passenger boarded, ride begins

#### `driver:ride:completed`
```json
{ "rideId": "uuid", "finalFare": 8500 }
```
- Driver marks ride complete (optional `finalFare` in centavos)

### Events: Passenger → Server

#### `ride:request`
```json
{
  "pickupLat": 6.7500,
  "pickupLng": 125.3573,
  "pickupAddress": "Gaisano Mall Digos",
  "dropoffLat": 6.7600,
  "dropoffLng": 125.3700,
  "dropoffAddress": "Digos City Hall",
  "paymentMethod": "CASH",
  "passengerCount": 2,
  "hasSeniorCitizen": false,
  "hasStudent": true,
  "hasExtraBaggage": false
}
```
- Passenger creates ride request
- Server validates passenger has no other pending/ongoing ride (returns 409 Conflict if so)
- Server broadcasts to nearby online drivers in `city:digos` room
- Server also sends targeted push notification to nearby drivers via FCM
- Ride details (pax count, senior/student, baggage) included in broadcast for driver decision-making

#### `passenger:ride:cancel`
```json
{ "rideId": "uuid", "reason": "DRIVER_TOO_FAR" }
```
- Passenger cancels ride
- Server checks cancellation window (free <2 min, tracked >2 min)

#### `system:ride:reconfirm-30min`
```json
{ "rideId": "uuid", "message": "Your ride is still pending. Still need it? Tap to keep active." }
```
- Scheduled cron job runs every 5 minutes
- Sends reconfirmation prompt to passengers with `REQUESTED` rides aged 30–35 minutes
- Passenger taps "Keep Active" → ride stays `REQUESTED`, timer resets for next interval
- No action taken → ride proceeds to 60-min reminder

#### `system:ride:reconfirm-60min`
```json
{ "rideId": "uuid", "message": "No drivers have accepted yet. Keep waiting or cancel?" }
```
- Sends second reconfirmation prompt to passengers with `REQUESTED` rides aged 60–65 minutes
- Passenger taps "Keep Waiting" → ride stays `REQUESTED`
- Passenger taps "Cancel" → ride `CANCELLED` by passenger, no penalty
- No action taken → ride proceeds to 90-min auto-cancel

#### `system:ride:auto-cancel`
```json
{ "rideId": "uuid", "reason": "No driver accepted within 90 minutes; passenger did not respond to reconfirmation prompts" }
```
- Auto-cancels `REQUESTED` rides older than 90 minutes with no driver activity AND passenger ignored both reconfirmation prompts
- Sets ride status to `CANCELLED` with actor = "SYSTEM"
- Checks passenger's auto-cancel history in last 7 days:
  - First 2 SYSTEM auto-cancels in 7 days: **no trust score penalty** (likely no drivers online)
  - 3rd+ SYSTEM auto-cancel in 7 days: **-5 trustScore** (repeat ghost-booker pattern)
- Increments passenger `autoCancelledCount`
- Sends push notification: "Your booking was auto-cancelled. Please try booking again."
- If `trustScore` drops below 70, passenger sees warning banner; below 50, temporary booking cooldown (24h)

### Events: Server → Client (both parties)

#### `ride:counter-offer`
```json
{
  "rideId": "uuid",
  "driverId": "uuid",
  "driverName": "Juan",
  "proposedFare": 2500,
  "estimatedFare": 1800,
  "reason": "Pickup distance 2.3km",
  "expiresAt": "2026-01-15T10:05:00Z"
}
```
- Sent to passenger when driver proposes counter-offer
- Passenger must accept or reject within 5 minutes

#### `ride:status`
```json
{
  "rideId": "uuid",
  "status": "ACCEPTED",
  "timestamp": "2026-01-15T08:30:00Z",
  "driver": {
    "id": "uuid",
    "name": "Juan Dela Cruz",
    "photoUrl": "...",
    "plateNumber": "ABC-123",
    "rating": 4.8,
    "currentLat": 6.7501,
    "currentLng": 125.3574
  }
}
```
Statuses: `REQUESTED` → `ACCEPTED` → `ARRIVING` → `STARTED` → `COMPLETED` | `CANCELLED`
Counter-offer branch: `REQUESTED` → `COUNTER_OFFERED` → `COUNTER_OFFER_ACCEPTED` → `ARRIVING` → `STARTED` → `COMPLETED`

#### `ride:location`
```json
{
  "rideId": "uuid",
  "lat": 6.7501,
  "lng": 125.3574,
  "heading": 180,
  "estimatedArrivalMinutes": 3
}
```
- Streamed to passenger while driver is en route

#### `ride:driver:cancelled`
```json
{ "rideId": "uuid", "reason": "VEHICLE_BREAKDOWN" }
```
- Driver cancelled after acceptance

#### `notification`
```json
{
  "type": "STRIKE_WARNING",
  "title": "Strike Warning",
  "body": "You received a strike for a no-show. 2 more strikes = 24h ban.",
  "data": { "strikeCount": 1, "rideId": "uuid" }
}
```
Notification types: `RIDE_ACCEPTED`, `DRIVER_ARRIVED`, `STRIKE_WARNING`, `KYC_APPROVED`, `KYC_REJECTED`, `LEADERBOARD_PRIZE`, `SYSTEM_ANNOUNCEMENT`

---

## Rate Limits

| Endpoint / Event | Limit | Window |
|-----------------|-------|--------|
| `POST /auth/verify-phone` | 5 | per 15 min per IP |
| `POST /auth/refresh` | 10 | per 15 min per IP |
| `PATCH /drivers/me/location` | 12 | per min per driver |
| `driver:location` Socket event | 12 | per min per driver |
| `ride:request` | 5 | per 5 min per passenger |
| `driver:ride:accept` | 10 | per min per driver |
| `POST /rides/:id/rate` | 1 | per ride |
| `POST /rides/:id/tip` | 1 | per ride |
| `POST /rides/:id/report` | 1 | per ride |
| All other endpoints | 100 | per min per IP |

---

## Zod Schema Examples

### Create Ride Request
```typescript
const CreateRideSchema = z.object({
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  pickupAddress: z.string().min(3).max(255),
  dropoffLat: z.number().min(-90).max(90),
  dropoffLng: z.number().min(-180).max(180),
  dropoffAddress: z.string().min(3).max(255),
  paymentMethod: z.enum(["CASH", "GCASH", "MAYA", "CARD"]).default("CASH"),
});
```

### Rate Driver
```typescript
const RateDriverSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
  thumbsUp: z.boolean().optional(),
});
```

### Report
```typescript
const ReportSchema = z.object({
  category: z.enum([
    "UNSAFE_DRIVING", "OVERCHARGING", "RUDE_BEHAVIOR",
    "WRONG_ROUTE", "VEHICLE_ISSUE", "NO_SHOW",
    "ABUSIVE_BEHAVIOR", "DAMAGED_VEHICLE", "REFUSED_PAYMENT", "OTHER"
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  description: z.string().max(2000).optional(),
});
```

### Platform Tip
```typescript
const TipSchema = z.object({
  amount: z.number().int().min(1).max(2000), // ₱1 to ₱20 in centavos
});
```

---

## Pagination Standard

All list endpoints support:
- `page` (int, default=1, min=1)
- `limit` (int, default=20, min=1, max=100)

Response includes:
```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Fare Calculation

### Formula
```
perPersonFare (centavos) = baseFare + (roadDistanceKm * perKmRate)
totalFare (centavos) = perPersonFare × passengerCount
// Road distance calculated via OSRM (Open Source Routing Machine), NOT straight-line (Haversine)

// LGU Discount (applied to each qualifying passenger's portion)
// If hasSeniorCitizen OR hasStudent: 20% off per qualifying passenger
// In practice: totalFare × 0.8 if ALL passengers are senior/student
// Or: (regularCount × perPersonFare) + (discountCount × perPersonFare × 0.8)
```

### Full Fare Calculation (with Per-Pax Pricing & Discounts)
```typescript
interface FareInput {
  pickup: LatLng;
  dropoff: LatLng;
  passengerCount: number;     // 1–6
  hasSeniorCitizen: boolean;
  hasStudent: boolean;
  pickupDistanceKm?: number;   // optional: driver-to-pickup distance (charged once, not per pax)
}

function calculateFare(input: FareInput): number {
  // 1. Road distance (dropoff route)
  const roadDistance = getRoadDistance(input.pickup, input.dropoff);

  // 2. Per-person fare
  const perPersonFare = Math.max(
    baseFare,
    baseFare + (Math.max(0, roadDistance - 1) * perKmRate)
  );

  // 3. Total before discount
  let totalFare = perPersonFare * input.passengerCount;

  // 4. LGU Discount (20% off for senior/student passengers)
  if (input.hasSeniorCitizen || input.hasStudent) {
    // Simplified: 20% off entire fare if any passenger qualifies
    // Advanced: (regularCount × perPersonFare) + (discountCount × perPersonFare × 0.8)
    totalFare = Math.round(totalFare * 0.8);
  }

  // 5. Optional pickup distance fee (flat, once per ride — driver compensation for long pickup)
  if (input.pickupDistanceKm && input.pickupDistanceKm > 1.5) {
    const pickupFee = Math.round(input.pickupDistanceKm * perKmRate * 0.5); // 50% of per-km rate for pickup
    totalFare += pickupFee;
  }

  return totalFare;
}
```

### Fallback Logic (When OSRM is Unavailable)
```typescript
function estimateFareFallback(pickup: LatLng, dropoff: LatLng): number {
  const straightLineKm = haversineDistance(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);

  if (straightLineKm <= 2.5) {
    // Most Digos rides are short; default to minimum fare per person
    return baseFare; // ₱16 per person
  } else {
    // Longer rides: Haversine × 1.3 factor (accounts for roads being ~30% longer than straight-line)
    const estimatedRoadKm = straightLineKm * 1.3;
    return Math.max(baseFare, baseFare + (Math.max(0, estimatedRoadKm - 1) * perKmRate));
  }
}
```

> **Rationale**: 2.5km straight-line ≈ 3.25km road distance ≈ ₱16 base + (2.25km × ₱10) = ₱38.50. But most short rides in Digos City cost the minimum ₱16, so defaulting to ₱16 within 2.5km is accurate for ~80% of rides.

### Default Digos City Rates (Admin Configurable)
| Parameter | Value | Description |
|-----------|-------|-------------|
| `baseFare` | ₱16.00 (1600 centavos) | Minimum fare for any ride |
| `perKmRate` | ₱10.00 (1000 centavos) | Per kilometer after first km |
| `maxDistance` | 10 km | Maximum ride distance allowed |
| `minDistance` | 0.2 km | Minimum distance for valid ride |

### Distance Calculation

**Primary (Production)**: OSRM (Open Source Routing Machine) API
```typescript
async function getRoadDistance(pickup: LatLng, dropoff: LatLng): Promise<number> {
  const osrmUrl = `http://osrm:5000/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=false`;
  const res = await fetch(osrmUrl);
  const data = await res.json();
  return data.routes[0].distance / 1000; // meters -> km
}
```

**Fallback**: Haversine (straight-line) if OSRM is unavailable
```typescript
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // km
}
```

### Fare Estimate Endpoint
```
GET /rides/estimate?pickupLat=...&pickupLng=...&dropoffLat=...&dropoffLng=...
Response: { estimatedFare: 2500, distanceKm: 1.0, baseFare: 1500, perKmRate: 1000 }
```

---

## Admin Impersonation

### Request
```
POST /admin/users/:id/impersonate
Headers: Authorization: Bearer <owner_token>  // Only OWNER can impersonate
Body: { reason: "Investigating ride dispute #123" }
Response: { impersonationToken: "<JWT with sub=targetUserId, impersonatedBy=ownerUserId>" }
```

### Impersonation JWT Claims
```json
{
  "sub": "target-user-id",
  "role": "PASSENGER",
  "impersonatedBy": "owner-user-id",
  "impersonationReason": "Investigating ride dispute #123",
  "iat": 1705300000,
  "exp": 1705303600 // 1 hour TTL
}
```

### Audit Log Entry
```json
{
  "action": "IMPERSONATION_START",
  "ownerId": "owner-user-id",
  "targetUserId": "target-user-id",
  "reason": "Investigating ride dispute #123",
  "timestamp": "2026-01-15T10:00:00Z",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0..."
}
```

Impersonation tokens have **1-hour TTL** and are **logged in every subsequent API call** via `x-impersonated-by` header.
