# TriQ — Monetization & Business Model

## Core Philosophy
> **Passengers ride for free. Drivers choose to pay for visibility.**

There are **zero fees** for passengers to book a ride. The platform earns revenue from driver subscriptions and optional digital tipping processing.

## Critical: TriQ is NOT an Escrow Platform

**We do NOT hold passenger or driver money.**
- **Ride fares** are paid **cash-only, directly from passenger to driver** at the end of each ride.
- **The platform never touches ride fares.** There is no wallet, no deposit, no pre-payment for rides.
- **Digital tips** are processed through PayMongo and forwarded to the driver (minus optional platform fee). These are the only funds the platform intermediates.
- **Subscriptions** are driver-to-platform payments for visibility features.

### Why This Matters for Fake Ride Protection
Because there is **no financial deposit or penalty held by the platform**, fake rides cannot be deterred by withholding money. Instead, we rely on:
- **Reputation strikes** (points deduction, temporary suspension)
- **KYC accountability** (verified real identities)
- **Matching algorithm penalties** (bad actors deprioritized in search)
- **Thumbs down / report consequences**
- **Leaderboard disqualification** for fraudulent rides

---

## 1. Driver Subscription Tiers

Drivers are the paying customers. Subscriptions are **monthly** and grant algorithmic visibility.

### Free Driver (₱0)
- Appears in passenger search results
- Listed after all paid drivers
- No badge or highlight
- Standard support (community/FAQ)

### Pro Driver — **"TriQ Pro"** (₱50/month, admin-configurable)
- **"PRO" badge** (cyan) displayed on driver card in passenger nearby list
- **Cyan highlighted card** in passenger nearby driver list
- **Sorted above FREE drivers** in nearby results (by distance within tier)
- **Rebook perk**: Passengers can request this driver directly — ride visible only to this driver; push notification sent to driver on rebook request
- Access to earnings analytics dashboard

> **Pricing is admin-configurable** via `/admin` → PayMongo Settings. Default: ₱50/month (5000 centavos), minimum ₱50. Stored in `SystemConfig` as `PAYMONGO_PRO_PRICE`.

### Elite Driver — **"TriQ Elite"** (₱99/month, admin-configurable)
- Everything in PRO, plus:
- **"ELITE" badge** (yellow/gold) displayed on driver card in passenger nearby list
- **Yellow highlighted card** — visually distinct from PRO
- **Sorted FIRST** in nearby results — always above PRO and FREE drivers
- **1.2× pickup radius bonus**: ELITE drivers appear in searches 20% beyond their set pickup radius, giving them wider visibility and more ride requests
- Push notification when subscription activates (via PayMongo webhook)

> **Pricing is admin-configurable** via `/admin` → PayMongo Settings. Default: ₱99/month (9900 centavos), minimum ₱99. Stored in `SystemConfig` as `PAYMONGO_ELITE_PRICE`.

### Subscription Lifecycle
```
Driver signs up ──► Free Pro Trial (7 days, tracked in Subscription as `isTrial=true`) ──► Chooses tier or stays Free
                          │
                          ▼
                    PayMongo Checkout
                          │
                          ▼
                    Active Subscription
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
         Auto-renew (webhook)    Expired / Cancelled
              │                       │
              ▼                       ▼
         Continues tier            Reverts to Free
```

### Payment Handling
- **Gateway**: PayMongo (Philippines-local, supports GCash, Maya, Card, QRPH)
- **Model**: Subscription via PayMongo Checkout sessions (Checkout Sessions API)
- **Payment methods**: `gcash`, `paymaya`, `card`, `qrph`
- **Webhooks**: Node.js API listens for `payment.paid`, `payment.failed`, `qrph.expired`, `qr.paid`, `qr.expired`, `link.payment.paid`
- **Webhook signature verification**: HMAC-SHA256 over `timestamp.rawBody` using PayMongo webhook secret. Header format: `t=TIMESTAMP,te=HMAC` (test) or `t=TIMESTAMP,li=HMAC` (live)
- **Payment matching**: Checkout sessions store `payment_intent_id` (from `session.data.attributes.payment_intent.id`) as `paymongoId` on the Tip/Subscription record. The `payment.paid` webhook carries `payment_intent_id` in `event.data.attributes.data.attributes.payment_intent_id`, which is used to match back to the record.
- **Raw body capture**: `express.raw({ type: 'application/json' })` applied to webhook route to preserve exact bytes for signature verification
- **Route ordering**: Webhook route registered before auth-protected `/tips` route to avoid JWT middleware blocking PayMongo's unauthenticated requests
- **Grace Period**: 3-day grace if auto-renew fails before reverting to Free
- **No Escrow**: All ride fares are cash-only, paid directly by passenger to driver. Platform never holds ride money.
- **Dev mode**: When `PAYMONGO_SECRET_KEY` not configured, subscriptions activate immediately without payment (for development/testing)

### Push Notifications on Payment Events
- **Subscription activated**: Driver receives FCM push ("👑 TriQ Pro/Elite Activated!") when PayMongo webhook confirms payment
- **Tip paid**: Passenger receives FCM push ("❤️ Tip Sent!") when PayMongo webhook confirms tip payment

### Privacy
- **Name masking**: All public-facing name fields (leaderboards, nearby driver list, ride API responses) use `maskName()` / `maskPassengerName()` / `maskDriverName()` to show `First L.` format instead of full names. Admin routes retain full names for KYC and management purposes.
- **VIP-only phone access**: Passenger phone numbers are only exposed to PRO/ELITE drivers in the active ride response. FREE drivers see passenger ID only — no phone number, no call button. This is a VIP perk that incentivizes subscription upgrades.
- **User IDs**: Both driver and passenger profiles display user IDs for reporting/reference purposes.

---

## 2. Passenger Tipping (Optional Platform Support)

### How It Works
- After ride completion, passenger sees an **optional "Support TriQ"** screen
- Preset amounts: ₱1, ₱2, ₱5, ₱10, ₱15, ₱20, or Custom
- Paid via GCash / Maya / Card through PayMongo
- **Tip goes directly to the platform** (TriQ) — not to the driver
- **Completely optional**: Passenger can skip with one tap; no pressure UI
- Shown as a voluntary "Thank you for keeping TriQ free" gesture

### Tip Flow
```
Passenger taps "Support TriQ ₱10"
         │
         ▼
PayMongo Payment Intent created
         │
         ▼
Passenger completes GCash/Maya/Card payment
         │
         ▼
Webhook confirms payment → Platform receives ₱10
         │
         ▼
Platform revenue recorded (Tip)
```

### Why Small Amounts
- ₱1–₱20 is psychologically easy to give ("just ₱5" feels negligible)
- Low friction increases conversion rate
- With 500 rides/day and 10% tipping at ₱5 average = ₱250/day = ₱7,500/mo extra revenue
- No driver payout complexity — straight to platform revenue
- PayMongo fees (~2.5-3.5%) absorbed as platform cost

---

## 3. Revenue Projections (Illustrative)

Assuming 100 active drivers after 6 months (using default prices — admin can adjust):
- 60 Free drivers = ₱0/mo
- 30 Pro drivers (₱50/mo) = ₱1,500/mo
- 10 Elite drivers (₱99/mo) = ₱990/mo
- **Total recurring**: ~₱2,490/mo (~$44 USD)

This covers VPS costs (~₱1,500-3,000/mo), domain, SSL, and leaves margin for growth.

---

## 4. Gamification as Engagement & Retention

Gamification is **not a direct revenue stream** but drives subscription conversion and driver retention.

### How It Drives Monetization
- **Leaderboard visibility** = more ride requests = more earnings = drivers stay subscribed
- **Weekly top-3 reward = free 1-month Pro** — hooks drivers on Pro benefits, increasing conversion
- **Badge display on driver card** — passengers prefer badge-holding drivers, creating social proof
- **Seasonal challenges** — spike activity during festivals (Kadayawan, Christmas), increasing ride volume

### Gamification Costs
- **Leaderboard prizes** (free Pro months) = lost subscription revenue, offset by increased engagement
- **Badge system** = near-zero cost (computed from existing ride data)
- **Seasonal challenge prizes** = sponsorship opportunity with local businesses

## 5. Future Revenue Streams

| Idea | Description | Complexity |
|------|-------------|------------|
| In-app Ads | Local business ads in passenger app (restaurants, sari-sari stores) | Medium |
| Priority Booking | ~~Passengers pay ₱5-10 to skip the queue~~ → **Currently free reward for top positive feedback + completion rate passengers only**; may become paid in Phase 3 | Low |
| Driver Insurance Partnership | Partner with local insurance for tricycle coverage | High |
| Delivery Mode | "TriQ Padala" — use tricycles for small package delivery | Medium |
| Event/Peak Pricing | Small surge fee during peak hours (shared with driver) | Medium |
| Gamification Sponsorships | Local businesses sponsor seasonal challenge prizes | Low |

---

## 6. What We Are NOT Doing
- ❌ Commission per ride (passengers and drivers resist this in tricycle culture)
- ❌ Passenger booking fees
- ❌ Forced driver subscription (always optional)
- ❌ Surge pricing at launch (keeps it simple)
