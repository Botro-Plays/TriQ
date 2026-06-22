# TriQ — Project Overview

## What is TriQ?
TriQ is a real-time, geo-location based tricycle hailing mobile application built specifically for **Digos City, Davao del Sur, Philippines**.

## Mission
To modernize tricycle transportation in Digos City by connecting passengers with nearby tricycle drivers instantly, while providing drivers a fair platform to earn and grow their business.

## Target Users
- **Passengers (Riders)** — everyday commuters needing quick, reliable tricycle rides
- **Passengers (Web Users)** — riders who prefer using a browser without installing an app
- **Drivers (Tricycle Operators)** — franchise holders and drivers looking for passengers
- **Admin / Dispatcher** — oversee operations, monitor rides, handle disputes

## Core Principles
- **Free for passengers** — no booking fees, no hidden charges
- **Fair monetization for drivers** — optional subscription for visibility, not mandatory
- **Cash for rides, tips for platform** — ride fares paid cash to driver; optional digital tips go to TriQ platform
- **Lightweight & fast** — works on budget smartphones and slower internet
- **Zero-cost APIs where possible** — OSM, Nominatim, Haversine — no Google Maps billing
- **Safety first through KYC** — verified drivers (franchise + license) and verified passengers (valid ID) create mutual trust
- **Browse before you verify** — passengers can explore the app and see fare estimates before submitting KYC

## Location Context
- **City**: Digos City
- **Province**: Davao del Sur
- **Region**: Davao Region (Region XI), Philippines
- **Map Coverage**: Entire Digos City + immediate outskirts (Barangay boundaries, landmarks, terminals)

## Development Status
- Phase: **MVP Complete — Deployed & Functional**
- Authentication: ✅ Firebase Phone OTP + Google Sign-In, JWT, Owner claiming
- Database: ✅ Prisma schema complete, PostgreSQL on Supabase, seeded with Digos City data
- CI/CD: ✅ GitHub Actions build check → Render auto-deploy
- Frontend: ✅ All pages implemented (passenger, driver, admin)
- Backend Routes: ✅ All routes implemented (auth, rides, drivers, passengers, admin, tips, subscriptions, gamification, leaderboards, reports)
- Real-time: ✅ Socket.io for live location and ride status
- Push Notifications: ✅ FCM for ride events, emergencies, subscriptions, tips
- Deployed: ✅ https://triq.dpdns.org

## Recently Completed (2026-06-22)
- Name masking: Passenger and driver names masked server-side in all ride API responses (`First L.` format)
- User ID display: Both driver and passenger profiles show user ID for reporting/reference
- Passenger cancel restriction: Passengers cannot cancel rides after driver has accepted (ACCEPTED/ARRIVING/IN_PROGRESS)
- VIP-only call passenger: Only PRO/ELITE drivers can call passengers; FREE drivers see upgrade hint
- FCM duplicate fix: `onMessage` handler properly unsubscribed in cleanup to prevent duplicate notifications
- Emergency browser notification fix: Uses `serviceWorker.ready.showNotification()` instead of `new Notification()` for foreground reliability
- Emergency resolve modal: Added recommended action checklist (call passenger, call driver, check maps, contact authorities, document outcome)
- Admin dashboard: Separate "Admin-Granted VIP" card counting free VIP grants vs paid subscriptions
- VIP countdown timer: Live days/hours/minutes/seconds countdown on driver profile for PRO/ELITE subscriptions
- Driver GET endpoints: Include `subscriptionExpiresAt` for frontend countdown timer

## Recently Completed (2026-06-21)
- Fixed Prisma Client generation on VPS (packaged from GitHub Actions)
- Fixed dotenv loading under PM2 (`__dirname`-based path)
- Google Sign-In as alternative to phone OTP
- Owner account seeding and claiming workflow
- Owner button hidden after claimed

## See Also
- `14-implementation-status.md` — detailed audit of every file
