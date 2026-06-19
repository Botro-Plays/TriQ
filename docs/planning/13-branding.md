# TriQ — Branding & Visual Identity Specification

## Overview

TriQ is a modern, approachable tricycle-hailing platform for Digos City. The brand identity reflects speed, trust, and local identity — powered by bold neon accents on a clean, confident base.

---

## Logo

### Primary Logo
- **Subject**: Yellow tricycle (side profile, facing right — forward motion)
- **Tricycle color**: Warm golden yellow (`#FACC15`)
- **Style**: Minimalist flat vector with subtle 2D depth; recognizable silhouette
- **Tricycle details**:
  - Sidecar body visible
  - Large rear wheel, smaller front wheel
  - Optional driver helmet silhouette (minimal, no face)
- **Background shape**: Circular badge or rounded hexagon with a neon glow effect
- **Glow effect**: Soft outer neon halo in cyan (`#06B6D4`) or magenta (`#EC4899`)
- **Edge treatment**: Subtle neon outline (1-2px) in cyan around the tricycle and badge border
- **Typography**: "TriQ" in bold modern sans-serif beside or below the mark
  - "Tri" in dark slate (`#1E293B`)
  - "Q" in neon cyan (`#06B6D4`) — the Q incorporates a subtle tricycle wheel negative space

### Logo Variants
| Variant | Use Case | Notes |
|---------|----------|-------|
| **Full logo** (mark + wordmark) | App splash screen, website hero, marketing | Horizontal layout; mark left, wordmark right |
| **Icon only** (mark) | App icon, favicon, map pin, push notification icon | Circular badge with neon glow; min 48×48px |
| **Wordmark only** | Headers, admin dashboard, email signatures | "TriQ" text with Q-highlight |
| **Monochrome** | Print, single-color contexts | Yellow tricycle becomes solid black/white; neon glow omitted |
| **Dark mode** | Dark theme UIs, night mode | Badge glow intensified; tricycle yellow brightened to `#FDE047` |

### App Icon
- 1024×1024px source
- Rounded square mask (iOS) / circular (Android adaptive icon)
- Yellow tricycle centered in circular badge with cyan neon glow
- Dark background (`#0F172A`) to make neon pop
- Foreground layer: tricycle + glow; Background layer: subtle radial gradient dark→slate

---

## Color Palette

### Primary Colors
| Color | Hex | Usage |
|-------|-----|-------|
| **TriQ Yellow** | `#FACC15` | Logo tricycle, primary CTAs, highlights, driver online status |
| **Neon Cyan** | `#06B6D4` | Logo glow, accent borders, active states, links, Q-lettermark |
| **Neon Magenta** | `#EC4899` | Secondary accent, promotional banners, new feature badges, tip success |

### Neutral Colors
| Color | Hex | Usage |
|-------|-----|-------|
| **Slate Dark** | `#0F172A` | Dark mode backgrounds, admin dashboard, night map theme |
| **Slate Base** | `#1E293B` | Primary text, headers, wordmark "Tri" |
| **Slate Light** | `#334155` | Secondary text, inactive states |
| **Cloud White** | `#F8FAFC` | Light mode backgrounds, cards |
| **Surface Gray** | `#E2E8F0` | Dividers, borders, disabled backgrounds |

### Semantic Colors
| Color | Hex | Usage |
|-------|-----|-------|
| **Success Green** | `#22C55E` | Ride accepted, payment successful, online status |
| **Warning Amber** | `#F59E0B` | Pending states, strikes, trust score warning |
| **Error Red** | `#EF4444` | Cancellations, penalties, strikes, emergency alerts |

### Neon Effects
- **Glow**: `box-shadow: 0 0 20px rgba(6, 182, 212, 0.4)` (cyan)
- **Edge glow**: `border: 1px solid #06B6D4; box-shadow: 0 0 8px #06B6D4`
- **Text glow**: `text-shadow: 0 0 10px rgba(6, 182, 212, 0.6)` (for headlines only)
- **Animated glow**: Subtle pulse animation on CTAs and loading states (1.5s ease-in-out infinite)

---

## Typography

### Primary Font Family
- **Headlines**: Inter or Poppins (bold, 700–800 weight)
- **Body**: Inter (regular, 400 weight)
- **Monospace** (for fares, codes): JetBrains Mono or SF Mono

### Type Scale
| Level | Size (Mobile) | Size (Web) | Weight | Usage |
|-------|---------------|------------|--------|-------|
| H1 | 28px | 40px | 800 | Splash screen, hero |
| H2 | 24px | 32px | 700 | Section headers |
| H3 | 20px | 24px | 700 | Card titles |
| Body | 16px | 16px | 400 | Paragraphs, descriptions |
| Caption | 12px | 12px | 500 | Labels, timestamps, small UI |
| Fare | 22px | 24px | 700 | Fare displays (monospace) |

### Typography Rules
- Headlines in Slate Base (`#1E293B`) or White on dark backgrounds
- Neon cyan used sparingly for emphasis (1–2 words per headline max)
- All caps for short labels (e.g., "ONLINE", "NEW", "FREE")
- Fare amounts always monospace with ₱ symbol

---

## UI Components

### Buttons
| Variant | Background | Text | Border | Shadow |
|---------|------------|------|--------|--------|
| Primary | `#FACC15` (yellow) | `#0F172A` | none | subtle yellow glow |
| Secondary | transparent | `#06B6D4` | 1px `#06B6D4` | cyan glow on hover |
| Danger | `#EF4444` | white | none | red glow |
| Ghost | transparent | `#334155` | none | none |

### Cards
- Background: `#FFFFFF` (light mode) / `#1E293B` (dark mode)
- Border radius: 12px (mobile), 16px (web)
- Shadow: `0 4px 16px rgba(15, 23, 42, 0.08)` (light) / `0 4px 16px rgba(0, 0, 0, 0.3)` (dark)
- Hover: subtle cyan glow border (`1px solid #06B6D4`) on interactive cards

### Input Fields
- Border: 1px `#E2E8F0`, radius 8px
- Focus: border `#06B6D4` with cyan glow
- Error: border `#EF4444` with red glow

### Map Theme
- Base map: OpenStreetMap with custom CartoDB Dark Matter or Voyager style
- Driver pins: Yellow tricycle icon with cyan glow pulse when online
- Passenger pin: Cyan dot with white halo
- Route line: Cyan (`#06B6D4`), 4px width, slight glow
- Active ride: Animated dashed cyan line with pulse

---

## Animation & Motion

### Micro-interactions
- **Button press**: Scale to 0.97 on tap, spring back
- **Loading states**: Yellow tricycle icon with rotating cyan glow ring
- **Success**: Checkmark draws with cyan stroke; subtle confetti (yellow + cyan particles)
- **Error**: Shake animation (translateX ±8px, 3 cycles)
- **New notification**: Badge slides in from top with cyan glow

### Transitions
- Screen transitions: Fade + slight slide up (200ms ease-out)
- Modal open: Scale from 0.95 to 1.0 + fade (150ms)
- Counter-offer popup: Slide in from bottom with spring physics

### Neon Pulse
- Applied to: primary CTA buttons, driver online indicator, "Support TriQ" tip button
- Animation: `opacity: 0.6 → 1.0 → 0.6`, duration 2s, infinite
- Color: Cyan glow shadow pulses in sync

---

## Imagery & Photography

### Driver Photos
- Required: well-lit, head-and-shoulders, neutral or Digos City street background
- Filter: slight warm tone to match brand yellow
- Frame: circular crop with 2px yellow border

### Vehicle Photos
- Required: full tricycle, side angle, clean and visible
- Background: blurred street scene or solid light gray
- Consistent lighting: daylight, no harsh shadows

### Marketing Imagery
- Hero images: yellow tricycle on Digos City streets at golden hour
- Overlays: subtle neon gradient (cyan→magenta) at 20% opacity on corners
- People: diverse passengers, friendly drivers, real Digos residents

---

## Tone of Voice

### Brand Personality
- **Friendly but efficient** — like a trusted local driver who knows all the shortcuts
- **Confident** — "We got you covered" not "We hope this works"
- **Local pride** — references Digos City, Davao del Sur, local landmarks naturally
- **Inclusive** — Tagalog + English (Taglish) in UI copy; Cebuano support mentioned

### Sample Copy
- **Booking confirmed**: "Padulong na ang driver!" (The driver is on the way!)
- **Fare estimate**: "Taya: ₱24" (Estimate: ₱24)
- **Tip thank you**: "Salamat sa pag-support sa TriQ!" (Thanks for supporting TriQ!)
- **Strike warning**: "Oh no! Strike recorded. Please be present when your driver arrives."
- **Counter-offer**: "Driver humangyo og ₱35 (ang taya kay ₱24). Dawaton?" (Driver requests ₱35, estimate was ₱24. Accept?)

### Copy Guidelines
- Use sentence case for buttons ("Book ride", not "Book Ride")
- Exclamation marks sparingly — only for genuine excitement (tips, promotions)
- Numbers always with ₱ symbol, no decimal if whole peso (₱24 not ₱24.00)
- Error messages: explain what happened + what to do next

---

## Platform-Specific Notes

### Mobile Apps (React Native)
- Status bar: dark background (`#0F172A`) with white icons
- Bottom navigation: 4 tabs (Home, Activity, Rewards, Profile) with cyan active tint
- Splash screen: animated yellow tricycle with expanding cyan glow, "TriQ" wordmark fades in
- Push notification icon: yellow tricycle on dark circular badge

### Web App (PWA)
- Browser theme color: `#0F172A` (dark slate)
- Manifest theme: `#FACC15` (yellow) for Chrome address bar tint
- Apple touch icon: full logo on dark rounded square
- Loading screen: centered logo with pulsing cyan glow

### Admin Dashboard
- Sidebar: dark slate (`#0F172A`) with yellow active indicator
- Data tables: alternating row colors; cyan hover glow on rows
- Charts: primary yellow line/bar, cyan accent, magenta comparison
- KPI cards: large numbers in monospace, yellow for positive, cyan for neutral

---

## Asset Deliverables

### Required Files (for design handoff)
- [ ] Logo source (SVG) — full, icon-only, wordmark-only
- [ ] Logo exports (PNG @ 1x, 2x, 3x) — all variants
- [ ] App icon source (SVG) + all required sizes (iOS: 20×20 to 1024×1024; Android: mdpi to xxxhdpi)
- [ ] Color palette (JSON / CSS variables)
- [ ] Typography specimens (Figma / PDF)
- [ ] UI component library (Figma design system)
- [ ] Map marker icons (SVG) — driver, passenger, pickup, dropoff
- [ ] Lottie animation files — loading tricycle, success checkmark, pulse glow
- [ ] Marketing templates (social media: 1080×1080, 1080×1920, 1200×628)

---

## Accessibility

- All text meets WCAG AA contrast (4.5:1 minimum)
- Neon glows never used on body text (headlines/decoration only)
- Color is never the sole indicator of status — always paired with icon or label
- Dark mode fully supported with maintained contrast ratios
- Motion respects `prefers-reduced-motion`: pulse animations disabled, transitions simplified to fades
