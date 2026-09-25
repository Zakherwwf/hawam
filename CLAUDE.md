# Project Guidelines: Hawem (حايم) Citizen-Science Platform (v2)

## 1. Scientific Data Rules (Non-Negotiable)
1. **The App Does Not Estimate Population Size**: The app collects structured, analysis-ready empirical data for scientific researchers.
2. **Every Observation Must Carry Effort Metadata**:
   - Who observed it (observer ID, role, experience level).
   - When (timestamp with timezone).
   - How long (survey duration, elapsed walking time).
   - Which track (GPS breadcrumb path length $L$).
3. **Structured Surveys Support Zero Sightings (Non-Detections)**:
   - eBird complete checklist model: "Did you record every cat and dog spotted on this route?".
   - Zero-animal complete surveys are scientifically essential for zero-inflated occupancy and SECR models. They receive full effort XP and rewards.
4. **Observer Location vs. Animal Location**:
   - The observer's GPS position is **not** the animal's position.
   - For every sighting, record observer GPS, device compass bearing, and estimated distance ($m$).
   - Compute animal coordinate using `@turf/destination` and perpendicular distance from transect using `@turf/point-to-line-distance`.
5. **Raw Data is Never Destroyed**:
   - Raw GPS points with timestamps and horizontal accuracy are retained even if simplified lines (Douglas-Peucker) are rendered on the map.
   - Low-accuracy points (>30m) are stored with a `rejected_reason` rather than discarded.

---

## 2. Gamification Integrity & Anti-Cheat Rules
1. **Effort Over Count**:
   - XP is heavily weighted toward survey duration, distance walked, completeness, and ID photo quality.
   - Animal count XP is strictly capped (max 20 XP per session) to prevent users from artificially inflating animal counts or double-counting.
   - Zero-animal surveys receive the full completion bonus (+20 XP).
2. **Anti-Cheat Validation**:
   - Server-side validation (`validate_session` Edge Function) checks for Android mock location flags, speeds >15 km/h during walking surveys, and GPS teleports.
   - Flagged sessions are marked `validation_status = 'flagged'` and do not count toward leaderboards.
3. **Leaderboard Metrics**:
   - Leaderboards rank by **km surveyed** and **complete survey checklists**, never by animal counts.

---

## 3. Design System Rules (Apple Human Interface Guidelines)
1. **Visual Language**:
   - Strict Apple HIG and iOS Liquid Glass material language on both iOS and Android.
   - Translucent blurs for top navigation, tab bars, and floating HUDs.
   - High contrast, 8-pt spacing grid, minimum 44×44 pt touch targets.
2. **Typography**:
   - iOS: SF Pro and SF Arabic.
   - Android: System font mapped to HIG type hierarchy (Large Title, Title 1-3, Headline, Body, Caption).
   - Support Dynamic Type / system font scaling.
3. **Icons & Zero-Emoji Mandate**:
   - **Zero emojis** across all production UI.
   - SF Symbols on iOS, mapped vector SVGs on Android.
4. **Trilingual & Full RTL Mirroring**:
   - Supported languages: **Arabic** (`ar-TN`, default, RTL), **French** (`fr`), **English** (`en`).
   - Full RTL layout mirroring in Arabic (navigation bars, list rows, back chevrons, icons).

---

## 4. Technical Architecture & Monorepo Structure
- `apps/mobile`: Expo SDK 57, TypeScript strict, Expo Router, Drizzle ORM + SQLite, Mapbox GL / `@rnmapbox/maps`.
- `apps/dashboard`: Research portal (Vite, React, Tailwind).
- `packages/shared`: Shared Zod schemas, TypeScript types, Darwin Core Archive & SECR R matrix exporters.
- `supabase/`: Migrations (PostGIS), RLS policies, Edge Functions, pgTAP security tests.
