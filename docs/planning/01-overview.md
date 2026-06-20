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
- Phase: **MVP Backend Scaffold + Auth Complete**
- Authentication: ✅ Firebase Phone OTP + Google Sign-In, JWT, Owner claiming
- Database: ✅ Prisma schema complete (all gap-analysis models), MySQL on VPS, seeded with Digos City data
- CI/CD: ✅ GitHub Actions → VPS auto-deploy with PM2
- Frontend: 🟡 Login page complete, all other pages are placeholder stubs
- Backend Routes: 🟡 Auth fully implemented, all other routes return 501
- Next step: Implement core ride flow (KYC → Driver online → Create/Accept ride → Complete)

## Recently Completed (2026-06-20)
- Fixed Prisma Client generation on VPS (packaged from GitHub Actions)
- Fixed dotenv loading under PM2 (`__dirname`-based path)
- Google Sign-In as alternative to phone OTP
- Owner account seeding and claiming workflow
- Owner button hidden after claimed

## See Also
- `14-implementation-status.md` — detailed audit of every file
