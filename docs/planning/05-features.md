# TriQ — Feature Specification & MVP Scope

## App Modules

### 1. Passenger App (React Native)

#### Authentication
- [ ] Phone number registration / login
- [ ] Firebase Auth OTP (SMS) verification
- [ ] Profile setup (name, emergency contact)
- [ ] Location permission request (Android + iOS)

#### KYC & Verification (Passenger)
- [ ] **Browse Mode** — non-KYC passengers can view the app, see map, view nearby drivers, and get fare estimates
- [ ] KYC prompt: "Complete verification to book rides" banner on map/booking screens
- [ ] Upload any **valid government-issued ID** (UMID, passport, driver's license, voter's ID, postal ID, etc.)
- [ ] Selfie photo + front ID photo + back ID photo (if applicable)
- [ ] Admin review and approval (typically within 24 hours)
- [ ] **Ride Booking Gate**: "Book Ride" button disabled with tooltip until KYC is `VERIFIED`
- [ ] KYC status indicator in profile (Unverified → Pending → Verified → Rejected)
- [ ] Re-upload option if rejected (with admin feedback reason)

#### Map & Ride Booking
- [ ] Interactive OSM map centered on Digos City
- [ ] Current location marker (blue dot)
- [ ] Pin drop to set pickup location
- [ ] Pin drop to set destination
- [ ] Address lookup via Nominatim geocoding
- [ ] "Nearby Drivers" button — shows available drivers on map
- [ ] Fare estimate display before booking (road distance via OSRM × rate per km; base fare ₱16 **per passenger**; **fallback**: if OSRM unavailable, default to ₱16 for rides within 2.5km; Haversine fallback for rides >2.5km; total = perPersonFare × passengerCount; **20% LGU discount applied if senior citizen or student**)
- [ ] **Ride details input** (in confirmation modal):
  - Number of passengers (default: 1, max: 6 for tricycle — Digos City standard)
  - Senior citizen? (toggle — may affect LGU-discounted fare)
  - Student? (toggle — may affect LGU-discounted fare)
  - Extra baggage? (toggle — warns driver, may affect capacity)
- [ ] Ride request button with confirmation modal

#### Active Ride
- [ ] Real-time driver location on map (Socket.io stream)
- [ ] Driver info card (name, plate number, photo, rating)
- [ ] Ride status timeline: Requested → Accepted → Arriving → In Progress → Completed
- [ ] Cancel ride button (free if no driver accepted; penalty if driver already accepted)
- [ ] Call driver button (direct phone call, not in-app)
- [ ] **Only 1 pending booking at a time**: passenger cannot request a new ride while another is pending/ongoing
- [ ] **Auto-cancel pending booking** (with reconfirmation prompts to avoid false positives):
  - **30 min**: Push notification: "Your ride is still pending. Still need it? Tap to keep active." (no penalty)
  - **60 min**: Push notification: "No drivers have accepted yet. Keep waiting or cancel?" (no penalty)
  - **90 min**: Auto-cancel if passenger never responded to reminders. First 2 auto-cancels in 7 days: **no penalty** (might be no drivers online). 3rd+ auto-cancel in 7 days: **-5 trust score** (repeat ghost-booker pattern).
- [ ] **Counter-offer notification**: Push notification + in-app popup when a driver proposes a different fare (includes pickup distance reason). Passenger can **accept** (ride proceeds at agreed fare) or **reject** (ride stays available for other drivers). Counter-offer expires in 5 minutes.

#### Post-Ride
- [ ] Fare summary screen
- [ ] **Cash payment confirmation** — passenger hands cash to driver; driver marks "Paid" in app; **platform never handles ride fare**
> **Note on haggling**: The estimated fare follows LGU tariff guidelines, but actual payment is between passenger and driver. Drivers may haggle (especially for long pickup distances), which is outside platform control. Passengers can report overcharging if excessive.
- [ ] **Support TriQ** button (PayMongo GCash/Maya/Card) — optional platform tip: ₱1, ₱2, ₱5, ₱10, ₱15, ₱20, or Custom
- [ ] Rate driver (1-5 stars + optional comment)
- [ ] **Thumbs Up / Thumbs Down** — quick binary feedback on the ride experience
- [ ] **Report Driver** — categories: unsafe driving, overcharging, rude behavior, wrong route, vehicle issue, other
- [ ] Optional photo/video attachment for reports
- [ ] Submit report confirmation

#### Fake Ride Protection (Passenger Side)
> **TriQ does not hold passenger money (no escrow).** Fake rides waste driver time and fuel. These protections deter abuse without pre-payment.
- [ ] **Strike system**: Passenger gets a "strike" for each verified fake ride (no-show after driver arrives)
  - [ ] 1st strike: Warning notification + educational pop-up
  - [ ] 2nd strike: 24-hour booking ban
  - [ ] 3rd strike: 7-day booking ban
  - [ ] 4th strike: 30-day ban + KYC re-review required
  - [ ] 5th strike: Permanent account suspension
- [ ] **Driver arrival confirmation**: Driver taps "I have arrived"; passenger has 3 minutes to confirm or cancel. No-show after 5 min = auto-cancel + strike risk
- [ ] **Cancellation window**: Free cancellation within 2 min of request; after 2 min, passenger must provide reason (tracked for pattern analysis)
- [ ] **KYC gate**: Only verified KYC passengers can book (reduces anonymous trolling)
- [ ] **Device/account linking**: One phone number per account; suspicious multi-account patterns flagged
- [ ] **Matching penalty**: Passengers with recent strikes deprioritized in driver search (driver sees "new rider" or "mixed feedback" warning)
- [ ] **Points deduction**: Fake ride = -50 passenger points; leaderboard disqualification for repeated offenses

#### Safety & Reporting
- [x] **Emergency button** during active ride (3-second hold to prevent accidental press) — primary: silent alert to admin (email/SMS); fallback: call configured emergency contact; option: call barangay tanod
- [x] **Share ride details** — send live ride link to trusted contact
- [ ] **Report history** — view status of submitted reports (pending / resolved / dismissed)

#### Ride History
- [x] List of past rides with date, route, fare
- [x] Tap to view details
- [x] **Re-book same route** — subscription perk: only available if the original driver has an active Pro subscription. Rebook creates a ride request visible only to that specific driver.

#### Gamification (Passenger View)
- [ ] **Driver Badges visible on ride request** — see driver achievements before accepting
- [ ] **Driver rank shown** in driver info card during active ride
- [x] **"Rate & Help them earn badges"** prompt after ride completion

#### Passenger Gamification & Leaderboard
- [ ] **Passenger Points System**: earn points for every completed ride, 5-star rating given, consecutive booking days, positive thumbs up received from drivers
- [ ] **Passenger Badges/Achievements**:
  - [ ] "First Trip" — completed first ride
  - [ ] "Frequent Flyer" — 50 rides completed
  - [ ] "Supporter" — sent platform tips 5 times
  - [ ] "Early Riser" — 10 rides before 7 AM
  - [ ] "Night Rider" — 10 rides after 8 PM
  - [ ] "Loyal Rider" — 30 consecutive days with at least 1 ride
  - [ ] "KYC Verified" — verified passenger badge
  - [ ] "Top Supporter" — top 10% platform tippers in the city
- [x] **Passenger Leaderboard tabs**: This Week / This Month / All Time
  - [x] Top by rides completed
  - [x] Top by platform tips given
  - [x] Top by average rating given
  - [ ] Top by consecutive booking days
- [ ] **Passenger profile card** shows badge collection + points total + city rank
- [ ] **Rank display**: "#5 Rider in Digos City this week"
- [ ] Passenger leaderboard rewards: weekly top-3 by **positive feedback + completion rate** get **free priority booking for 1 week** (Phase 2)

#### Settings
- [ ] Edit profile
- [ ] Saved places (Home, Work, etc.)
- [ ] Notification preferences
- [ ] Logout

---

### 2. Driver App (React Native)

#### Authentication
- [ ] Phone number registration / login (Firebase OTP)

#### KYC & Verification (Driver) — **Mandatory before going online**
- [ ] Upload **tricycle franchise certificate** (issued by Digos City LGU)
- [ ] Upload **driver's license** (valid, non-professional or professional)
- [ ] Upload **OR/CR** (official receipt / certificate of registration for the tricycle)
- [ ] Upload **selfie photo** + **front ID photo** + **back ID photo** (if applicable)
- [ ] Vehicle inspection photo (front, side, plate clearly visible)
- [ ] Admin review and approval workflow:
  - [ ] Document completeness check
  - [ ] Franchise validity verification
  - [ ] License expiration check
  - [ ] Vehicle-photo vs OR/CR plate number match
- [ ] Driver status: `PENDING` → `VERIFIED` (can go online) or `REJECTED` (with reason)
- [ ] Re-submit option if rejected
- [ ] Annual re-verification reminder (franchise/ID expiry)

#### Dashboard (Home)
- [ ] Toggle online/offline status
- [ ] Earnings summary (today, this week, this month)
- [ ] Subscription status banner (Free / Pro / Elite + expiry date)
- [ ] Upgrade to Pro/Elite button → PayMongo checkout

#### Map & Ride Requests
- [ ] Interactive OSM map with current location
- [ ] Ride request popup:
  - Passenger location, destination, **pickup distance from driver**, estimated fare
  - **Ride details**: passenger count, senior/student flags, extra baggage flag
  - Passenger rating (thumbs ratio)
- [ ] **Call passenger** button (direct phone call — appears BEFORE accept, to clarify details, pickup location, or negotiate verbally)
- [ ] Accept / **Counter-offer** / Decline buttons (10-second auto-decline if no action)
  - **Counter-offer**: Driver enters proposed fare (can include pickup distance rationale); sent to passenger for approval
  - Counter-offer expires in 5 minutes; if accepted, ride proceeds at agreed fare
- [ ] **Configurable pickup radius**: Driver sets max distance they're willing to travel to pick up passengers (default: 2km). Only requests within this radius appear.
- [ ] **Expand radius**: Driver can temporarily expand search radius if no nearby requests
- [ ] **Pickup distance warning**: If pickup is >1.5km, popup shows "Long pickup — driver may ask for additional fare"
- [ ] After accept (or counter-offer accepted): navigation hints to pickup location
- [ ] "Arrived at pickup" button (validated via GPS proximity + photo confirmation if GPS is inaccurate)
- [ ] "Start ride" button (when passenger boards)
- [ ] "Complete ride" button

#### Active Ride
- [ ] Passenger details (name, rating)
- [ ] Route display on map
- [ ] Real-time location broadcast to passenger
- [ ] Cancel ride button (with reason selection)
- [ ] **Cannot accept new ride while already has an active/pending ride**

#### Earnings Audit (Estimated — Platform Does Not Handle Cash)
> Since ride fares are paid **cash directly from passenger to driver**, the platform cannot know the actual amount collected. Instead, the app shows an **audit based on estimated fares** for the driver's own record-keeping and tax/documentation purposes.
- [ ] **Daily view**: Today's rides — count, list with estimated fares, total estimated earnings
- [ ] **Weekly view**: This week's rides — count, total estimated earnings, average per ride, best day
- [ ] **Monthly view**: This month's rides — count, total estimated earnings, trend vs last month
- [ ] **All-time view**: Lifetime rides, total estimated earnings, average rating
- [ ] **Per-ride audit**: Ride date, pickup → dropoff, estimated fare, actual fare field (driver can optionally enter what they actually collected for personal records)
- [ ] **Export**: Generate PDF/CSV earnings report for a date range (useful for tax filing or loan applications)
- [ ] **Offline access**: Cached earnings data viewable even without internet
- [ ] **Disclaimer banner**: "Estimated fares shown. Actual cash collection may vary. Platform does not handle ride payments."

#### Post-Ride (Driver Side)
- [ ] **Thumbs Up / Thumbs Down** the passenger — quick feedback
- [ ] **Report Passenger** — categories: no-show, abusive behavior, damaged vehicle, refused to pay, other
- [ ] Optional photo attachment for reports

#### Fake Ride Protection (Driver Side)
> **TriQ does not hold driver money (no escrow).** Fake rides waste driver time, fuel, and lost income from real passengers.
- [ ] **Strike system**: Driver gets a strike for each verified fake ride (accepts but never shows, or cancels repeatedly after accepting)
  - [ ] 1st strike: Warning + mandatory re-read community guidelines
  - [ ] 2nd strike: 24-hour online ban
  - [ ] 3rd strike: 7-day online ban + subscription paused (no refund)
  - [ ] 4th strike: 30-day ban + KYC re-review
  - [ ] 5th strike: Permanent deactivation
- [ ] **Accept timeout**: 15 seconds to accept; auto-decline prevents "ghost accepting"
- [ ] **Cancellation tracking**: Driver cancellation rate monitored; >20% cancellation rate triggers review
- [ ] **Arrival confirmation required**: Driver must tap "I have arrived" within reasonable time based on GPS distance; faking arrival without proximity = strike
- [ ] **GPS proximity validation**: Backend checks driver GPS is within 100m of pickup before allowing "Arrived" status
- [ ] **Ride completion validation**: Minimum ride distance (≥200m) + minimum time (≥2 min) before ride counts as "completed" for points/badges
- [ ] **Points deduction**: Fake ride = -100 driver points; leaderboard reset for that period
- [ ] **Subscription impact**: Drivers on Pro/Elite with active strikes lose priority matching until strike clears
- [ ] **Matching penalty**: Drivers with recent strikes appear lower in passenger search results

#### Driver View: Passenger Leaderboards
- [ ] View top passengers in Digos City (rides, positive ratings, supporter badges)
- [ ] See passenger badges and rank when ride request comes in
- [ ] "VIP Passenger" indicator for top-ranked passengers (optional priority acceptance)

#### Safety & Reporting
- [x] **Emergency button** during active ride
- [x] **Share ride details** — live ride link to family/contact
- [ ] **Report history** — view status of submitted reports

#### Subscription
- [ ] Current tier display with benefits list
- [ ] Upgrade / Renew / Cancel subscription
- [ ] Payment history (subscription invoices)

#### Gamification & Leaderboard
- [ ] **Driver Points System**: earn points for every completed ride, 5-star rating, consecutive login days
- [ ] **Badges/Achievements**:
  - [ ] "First Ride" — completed first ride
  - [ ] "Century Club" — 100 rides completed
  - [ ] "Early Bird" — 20 rides before 7 AM
  - [ ] "Night Owl" — 20 rides after 8 PM
  - [ ] "Perfect Week" — 7 consecutive days with at least 1 ride
  - [ ] "Rising Star" — reached top 10% on any leaderboard
  - [ ] "Franchise Holder" — verified KYC badge (always visible)
  - [ ] "TriQ Pro" / "TriQ Elite" — subscription tier badges
- [x] **Leaderboard tabs**: This Week / This Month / All Time
  - [x] Top by rides completed
  - [x] Top by earnings (finalFare sum)
  - [x] Top by average rating
  - [ ] Top by consecutive days online
- [ ] **Driver profile card** shows badge collection + points total
- [ ] **Rank display**: "#3 in Digos City this week"
- [ ] Leaderboard rewards: weekly top-3 get **free Pro subscription for 1 month** (Phase 2)

#### Settings
- [ ] Edit profile (name, photo, tricycle plate number)
- [ ] Vehicle info
- [ ] Notification preferences
- [ ] Logout

---

### 3. Web Passenger App (React + Vite PWA)

Full-featured browser alternative to the mobile passenger app. Works on desktop, tablet, and mobile browsers.

#### Authentication
- [ ] Phone number registration / login (Firebase OTP, same as mobile)
- [ ] "Continue without installing app" prompt after OTP
- [ ] Profile setup (name, emergency contact)
- [ ] Browser geolocation permission request

#### KYC & Verification (Passenger)
- [ ] **Browse Mode** — same as mobile: view map, see drivers, get estimates without KYC
- [ ] KYC gate on ride booking: "Complete verification to book rides"
- [ ] Upload valid government-issued ID
- [ ] Selfie verification (camera capture via browser `getUserMedia`)
- [ ] Admin review and approval
- [ ] KYC status indicator in profile
- [ ] Re-upload option if rejected

#### Map & Ride Booking
- [ ] Interactive Leaflet OSM map centered on Digos City
- [ ] Current location marker via Browser Geolocation API
- [ ] Click-to-set pickup and destination pins
- [ ] Address lookup via Nominatim geocoding
- [ ] Nearby driver markers on map
- [ ] Fare estimate display before booking (road distance via OSRM × rate per km; base fare ₱16 **per passenger**; **fallback**: if OSRM unavailable, default to ₱16 for rides within 2.5km; Haversine fallback for rides >2.5km; total = perPersonFare × passengerCount; **20% LGU discount applied if senior citizen or student**)
- [ ] **Ride details input** (in confirmation modal):
  - Number of passengers (default: 1, max: 6 for tricycle — Digos City standard)
  - Senior citizen? (toggle)
  - Student? (toggle)
  - Extra baggage? (toggle)
- [ ] Ride request with confirmation modal

#### Active Ride
- [ ] Real-time driver location on map (Socket.io)
- [ ] Driver info card (name, plate, photo, rating)
- [ ] Ride status timeline
- [ ] Cancel ride button (free if no driver accepted; penalty if driver already accepted)
- [ ] **Only 1 pending booking at a time**: cannot request new ride while another is pending/ongoing
- [ ] **Auto-cancel pending booking** (with reconfirmation prompts):
  - **30 min**: Browser push: "Your ride is still pending. Still need it? Tap to keep active." (no penalty)
  - **60 min**: Browser push: "No drivers have accepted yet. Keep waiting or cancel?" (no penalty)
  - **90 min**: Auto-cancel if no response. First 2 auto-cancels in 7 days: **no penalty**. 3rd+ in 7 days: **-5 trust score**.
- [ ] **Counter-offer notification**: Browser push notification + in-app banner when driver proposes different fare. Accept (proceed at agreed fare) or reject (ride stays available for others). Expires in 5 minutes.

#### Post-Ride
- [ ] Fare summary screen
- [ ] Cash payment confirmation
> **Note on haggling**: The estimated fare follows LGU tariff guidelines, but actual payment is between passenger and driver. Drivers may haggle (especially for long pickup distances), which is outside platform control. Passengers can report overcharging if excessive.
- [ ] **Support TriQ** button (PayMongo) — optional platform tip: ₱1–₱20
- [ ] Rate driver (1-5 stars + optional comment)
- [ ] **Thumbs Up / Thumbs Down** — quick binary feedback
- [ ] **Report Driver** — categories with optional photo/video

#### Safety & Reporting
- [x] **Emergency button** during active ride (3-second hold to prevent accidental press) — primary: silent alert to admin (email/SMS); fallback: call configured emergency contact; option: call barangay tanod
- [x] **Share ride details** — live ride link to trusted contact
- [ ] **Report history** — track submitted report status

#### Fake Ride Protection
- [ ] Same strike system, cancellation rules, and KYC gate as mobile passenger app
- [ ] Browser-based strike warning banners

#### Ride History
- [x] List of past rides
- [x] View details, re-book same route (subscription perk — only if driver has active Pro subscription)

#### Gamification (Passenger View)
- [ ] **Driver Badges visible** when selecting a driver on map
- [ ] **Driver rank and points** shown in driver card
- [ ] **"Help your driver earn badges!"** CTA after rating

#### Passenger Gamification & Leaderboard
- [ ] Same points, badges as mobile passenger app
- [x] Browser-based leaderboard viewer (responsive, This Week / This Month / All Time tabs)
- [ ] Share rank/badge to social media (optional)

#### Settings
- [ ] Edit profile
- [ ] Saved places (Home, Work)
- [ ] Notification preferences (browser push via FCM service worker)
- [ ] Install PWA shortcut (optional)
- [ ] Logout

#### PWA Features
- [ ] Service worker for offline map tile caching
- [ ] Add to Home Screen prompt on mobile browsers
- [ ] Background sync for ride status updates
- [ ] Push notifications for ride events (driver arrived, completed)

---

### 4. Landing Page (React + Vite)

Public-facing marketing site served at root domain.

#### Homepage
- [ ] Hero section: "Book a Tricycle in Digos City — Fast, Easy, Free"
- [ ] Live stats: drivers online now, rides completed today, city coverage
- [ ] "Download the App" — Google Play + App Store badges
- [ ] "Use Web Version" — direct link to web passenger app (no download required)
- [ ] "Become a Driver" — CTA linking to driver app download + benefits

#### How It Works
- [ ] 3-step visual: Open App → Pin Location → Ride
- [ ] Passenger features highlights
- [ ] Driver benefits (earn more, flexible hours)

#### Coverage Area
- [ ] Interactive Digos City map showing service zones
- [ ] List of covered barangays and landmarks
- [ ] Estimated wait times by zone

#### Driver Recruitment
- [ ] Requirements checklist (franchise, license, tricycle)
- [ ] Earnings potential calculator
- [ ] "Sign up as Driver" → deep link to driver app

#### Footer
- [ ] Contact info / support email
- [ ] Social media links
- [ ] Privacy policy + Terms of service links
- [ ] App download badges (repeat)

---

### 5. Admin Web Dashboard (React + Vite)

#### Overview Dashboard
- [x] Total rides today
- [x] Active drivers online now
- [x] Active rides in progress
- [x] Revenue from subscriptions (₱)
- [x] Revenue from platform tips (₱)
- [x] Total fares from completed rides (₱)
- [x] Subscription tier breakdown (active / Pro counts)
- [ ] Map view of all active rides and online drivers

#### KYC & Document Review
- [ ] **Driver KYC Queue** — list all pending driver verifications
- [ ] Driver document viewer (franchise, license, OR/CR, selfie, vehicle photo)
- [ ] Side-by-side ID vs selfie comparison tool
- [ ] Approve / Reject driver KYC with reason text
- [ ] **Passenger KYC Queue** — list all pending passenger verifications
- [ ] Passenger ID viewer
- [ ] Approve / Reject passenger KYC with reason text
- [ ] Document expiry alerts (franchise, license nearing expiration)
- [ ] KYC audit log (who reviewed, when, decision, notes)

#### Driver Management
- [ ] List all drivers with filter (pending KYC, pending approval, active, suspended, offline, online)
- [ ] **Driver detail view**: Full profile, phone, plate number, vehicle info, photo, KYC status, current strike count, points total, badges earned, subscription tier + expiry
- [ ] **Edit driver profile**: Update name, phone, plate number, vehicle info, photo (with audit log)
- [ ] **Reset driver password**: Force Firebase password/OTP reset
- [ ] **Force logout**: Terminate all active sessions for a driver
- [ ] **Toggle driver online/offline**: Admin can force a driver offline (e.g., during emergencies or violations)
- [ ] Approve / Reject / Suspend / reactivate driver actions
- [ ] Subscription management (extend, refund, manually assign tier, change tier)
- [ ] View driver notification preferences
- [ ] **Driver impersonation**: Login as driver for support (full audit log of all actions taken)

#### Driver Earnings Audit
> Platform shows **estimated fare audits only** — actual cash collection is between passenger and driver.
- [ ] **Per-driver earnings view**: Daily / Weekly / Monthly / All-time estimated earnings
- [ ] **Aggregate city earnings**: Total estimated driver earnings across all drivers (useful for economic impact reports to LGU)
- [ ] **Earnings trends**: Graph of estimated earnings per driver over time
- [ ] **Top earners leaderboard**: Drivers ranked by estimated earnings (monthly/all-time)
- [ ] **Audit disclaimer**: All earnings figures are estimated based on platform-calculated fares; actual cash collection may differ

#### Passenger Management
- [x] List passengers with search, KYC status, trust score, ride/strike counts
- [ ] **Passenger detail view**: Full profile, phone, emergency contact, KYC status, current strike count, points total, badges earned
- [ ] **Edit passenger profile**: Update name, phone, emergency contact (with audit log)
- [ ] **Reset passenger password**: Force Firebase password/OTP reset
- [ ] **Force logout**: Terminate all active sessions for a passenger
- [ ] View passenger ride history
- [ ] View passenger KYC documents
- [ ] View passenger saved places (Home, Work, etc.)
- [ ] View passenger notification preferences
- [x] Suspend / reinstate passengers (trust score → 0)
- [ ] **Passenger impersonation**: Login as passenger for support (full audit log of all actions taken)

#### Ride Monitoring
- [ ] Real-time map of all rides
- [ ] Ride detail view (passenger, driver, route, status, fare, estimated fare, actual fare if driver entered it)
- [ ] **All rides list**: Search/filter by date range, passenger, driver, status, fare range
- [ ] **Ride fare summary view**: Per-ride breakdown of estimated vs actual fare (if entered by driver)
- [ ] **Counter-offer log**: Track all counter-offers (driver, proposed fare, reason, passenger response, expiry time)
- [ ] Intervene / cancel ride if needed
- [ ] Dispute resolution panel
- [ ] **Emergency response log**: All emergency button presses with timestamp, ride link, location, alert type (admin/SMS/call), resolution status

#### Ratings & Reviews Management
- [x] **All ratings list**: View every passenger→driver rating (1-5 stars, comment, thumbs up/down)
- [x] **Filter ratings**: By rating level (low 1-2★, mid 1-3★, all)
- [ ] **Moderate ratings**: Hide/soft-delete abusive or fake ratings (with reason, visible to admin only)
- [x] **Rating analytics**: Platform-wide average rating displayed
- [ ] **Thumbs up/down analytics**: Overall thumbs ratio per driver, per passenger, platform-wide trends
- [ ] **Driver-submitted passenger feedback**: View all driver thumbs up/down on passengers (used for matching quality)

#### Driver Gamification & Engagement
- [x] **Driver Leaderboard viewer** (rides, earnings, rating — weekly/monthly/all-time)
- [ ] Driver badge/achievement management (enable/disable, create seasonal)
- [ ] Driver points configuration (points per ride, per star, per day online, etc.)
- [ ] Driver gamification analytics (engagement rate, leaderboard participation)
- [ ] Driver seasonal challenges setup

#### Passenger Gamification & Engagement
- [x] **Passenger Leaderboard viewer** (rides completed, platform tips given, average rating — weekly/monthly/all-time)
- [ ] Passenger badge/achievement management (enable/disable, create new badges)
- [ ] Passenger points configuration
- [ ] Passenger gamification analytics
- [ ] Passenger seasonal challenges setup

#### Combined Challenges
- [ ] Seasonal challenges setup (e.g., "Kadayawan Festival Challenge — most rides wins Pro 1 month")

#### Reports & Disputes
- [ ] **Report queue** — all passenger-reported-driver and driver-reported-passenger incidents
- [ ] Filter by: status (pending, investigating, resolved, dismissed), severity (low, medium, high, critical), category
- [ ] Report detail view: reporter, reported user, ride link, category, description, attachments
- [ ] **Actions per report**: mark investigating, resolve with note, dismiss with reason, escalate to suspension
- [ ] **Auto-suspend triggers**: 3+ reports within 30 days = automatic temporary suspension pending review
- [ ] **Reporter protection**: anonymous to reported party; reporter identity only visible to admin
- [ ] **Dispute resolution**: both parties can submit statements; admin adjudicates
- [ ] Report analytics: common complaint types, repeat offenders, resolution time

#### Strike Management (Fake Ride Protection)
> TriQ does **not hold money in escrow**. Strikes are the primary deterrent against fake rides.
- [x] **Passenger strike queue**: List all passengers with active strikes
- [ ] **Driver strike queue**: List all drivers with active strikes, ordered by severity
- [ ] **Strike detail view**: Which ride triggered it, GPS data, cancellation timing, both party statements
- [x] **Override strikes**: Admin can revoke strikes
- [ ] **Appeals workflow**: Users can submit appeal → admin reviews → decision with note
- [ ] **Strike analytics**: Fake ride rates by user segment, city-wide fake ride trend, strike effectiveness
- [ ] **Auto-escalation rules**: Configure thresholds (e.g., 3 auto-cancels in 1 day = auto-strike)
- [ ] **Strike notification templates**: Customize warning/ban messages per strike level

#### Payments & Subscriptions
- [x] Subscription revenue report (active subscription revenue aggregate)
- [x] **Subscription list**: All subscriptions with tier, status, driver info, amount, dates, trial flag
- [ ] **Subscription detail per driver**: Tier history, payment history, expiry dates, grace period status
- [x] Platform tip transaction log (all tips with status filter, total paid tips)
- [ ] **Tip analytics**: Tipping conversion rate, average tip amount, tips by time of day, tips by ride count

#### App Configuration & Feature Flags
- [x] **System config viewer**: View all key-value config entries
- [x] **System config editor**: Edit config values inline
- [ ] **Browse mode toggle**: Enable/disable non-KYC browse mode globally
- [ ] **KYC requirement toggle**: Make KYC optional vs mandatory for booking (emergency override)
- [ ] **Gamification master switch**: Enable/disable all leaderboards, badges, points globally
- [ ] **Tipping master switch**: Enable/disable platform tipping UI globally
- [ ] **Subscription sales toggle**: Enable/disable Pro/Elite subscription purchases (e.g., during promo periods)
- [ ] **Maintenance mode**: Toggle "TriQ is under maintenance" banner; prevent new bookings
- [ ] **City configuration**: Add/remove cities, set active service areas, city-specific base fares
- [ ] **Fare rate editor**: Live edit base fare and per-km rate (effective immediately or scheduled)

#### System Analytics & Audit
- [ ] **User growth funnel**: Signups → KYC submitted → KYC approved → First ride → 7-day retention → 30-day retention
- [ ] **Driver retention cohorts**: Drivers by signup month — active rate over time
- [ ] **Passenger retention cohorts**: Passengers by signup month — active rate over time
- [ ] **Peak hour heatmap**: Historical ride demand by hour and day-of-week
- [ ] **Barangay demand map**: Which barangays generate the most ride requests
- [ ] **Admin action audit log**: Every admin action (impersonation, strike override, KYC approval, profile edit) with timestamp, admin ID, reason
- [ ] **API health metrics**: Request volume, error rate, average response time per endpoint

#### Settings
- [ ] Fare rate configuration (base fare, per km rate, Digos City zones)
- [ ] Notification templates (SMS, push)
- [ ] System announcements (broadcast to all users)

---

## MVP Scope (Phase 1 — Launch)

**Must Have for Launch:**
1. Passenger & Driver phone OTP auth
2. Passenger can set pickup + destination, see fare estimate
3. Nearby driver discovery (PostGIS `ST_DWithin`)
4. Ride request → driver accept → live tracking → complete
5. Cash payment only (no digital payment at launch)
6. Driver rating after ride
7. Driver online/offline toggle
8. Driver document upload + admin approval
9. Free driver tier only (subscriptions & tipping in Phase 2)
10. Admin dashboard with driver approval + ride monitoring
11. **Landing page** with app download links + "Use Web Version" CTA
12. **Web Passenger App (PWA)** — full ride booking via browser (no install required)

**Phase 2 (Post-Launch):**
- Driver subscription tiers (Pro/Elite)
- Passenger platform tipping via PayMongo
- In-app reporting & disputes
- Saved places for passengers
- Earnings analytics for drivers

**Phase 3 (Future):**
- Push notifications (FCM)
- Route optimization with OSRM
- Surge / peak pricing
- In-app chat passenger ↔ driver
- Delivery mode (TriQ Padala)
- Local business ads
