# Hawem — App Review & Modernisation Roadmap

Review date: 2026-09-25 · Branch reviewed: `claude/relaxed-keller-imwe7u` @ `f78d287`
Scope: `apps/mobile`, `apps/dashboard`, `packages/shared`, `supabase/`

**Audience change.** Hawem now targets volunteers worldwide. Arabic/RTL is no longer a priority, and English is the source language. Every recommendation below assumes a global, anonymous, mostly-Android volunteer base on mid-range phones. Recommendations that only made sense for Tunisia (governorates, `TUN-OBS-` IDs, a Tunis map centre, Arabic rank titles) are listed for removal.

**Relationship to `TECHNICAL_REVIEW.md`.** An earlier review exists at the repo root. This document was written from the code itself: every finding was re-checked against the source, and the app's type-checker and test suites were run. It confirms most of that review, corrects three of its claims (§9), and adds the most serious defects it missed. These are in §2 and §3: survey data can be silently lost, and the backend the app talks to cannot be rebuilt from the repo. This document also goes much further on UI/UX (§5–§7).

---

## 0. Verification baseline

What was actually run, so the rest of this document can be trusted:

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | OK |
| `tsc --noEmit` — mobile | **0 errors** (strict mode on) |
| `tsc --noEmit` — dashboard | **0 errors** |
| `pnpm test` — mobile | **44 / 44 pass** |
| `pnpm test` — shared | **5 / 5 pass** |

So the code compiles cleanly and the unit tests pass. **The problems are in behaviour, not compilation.** The tests cover pure helpers (geo math, XP arithmetic, parsers). They do not cover the survey lifecycle, the sync queue or the backend contract, and that is where the serious defects are.

Codebase shape (mobile): ~27,800 lines of TS/TSX. The five largest screens are 1,379–2,455 lines each. `StructuredSurveyScreen.tsx` alone is 2,455 lines with 40+ `useState` hooks.

---

## 1. Scorecard

| Area | Grade | One-line verdict |
|---|---|---|
| Scientific design (schema, protocols, docs) | **A-** | Publication-grade intent: effort metadata, non-detections, observer vs. animal location, DwC. |
| Survey data integrity (what actually reaches the DB) | **F** | Surveys can be lost on a tab switch or app restart; fields are hard-coded; GPS failure fabricates distance. |
| Backend reproducibility | **F** | The RPC the app calls is not in any migration; migration 000004 cannot apply on a fresh database. |
| Security & privacy | **D** | Public photo bucket plus a no-op EXIF scrubber means photos can expose home coordinates. Anonymous users can read raw observation rows. |
| Gamification integrity | **D** | XP lives only on the device, can be farmed, and the leaderboard is fake. |
| UI visual polish | **B-** | Attractive and on-brand, but built from 1,002 hard-coded colour literals. |
| UX / information architecture | **C-** | No navigation stack, modals replace the whole app, and the "dashboard vs map" toggle is hidden inside a tab. |
| Accessibility | **D** | 9 `accessibilityLabel`s across 187 touchables; most text is 9–13 pt; dark mode reaches 6 files. |
| Global readiness | **D** | Tunisia is hard-coded in 143 places; French covers 98/166 keys; no units localisation. |
| Tooling / CI | **F** | No lint, no CI, no crash reporting, no OTA updates. |

---

## 2. P0 — Data-loss and data-corruption defects (fix first)

These break the product's central promise: collecting data researchers can trust. They matter more than any visual work.

### 2.1 Switching tabs mid-survey destroys the survey
`App.tsx:587` renders `<StructuredSurveyScreen>` conditionally (`activeTab === 'survey' ? … : …`). All live survey state (timer, track, detections) is held in `useState` inside that screen (`StructuredSurveyScreen.tsx:121-158`). Tapping any other tab unmounts the screen and **silently discards the entire session**. The same happens when `activeModal` is set (`App.tsx:470-530` returns early, before the tab tree). Nothing is persisted, and there is no recovery path.

`src/features/survey/surveyStore.ts` is a well-designed Zustand state machine, including a `recovered` state, but **no file imports it**. It is dead code.

**Fix:** Move the survey to the store and persist it to SQLite on every state change. Mount the live survey as a full-screen route that the tab bar cannot reach (§6).

### 2.2 The outbox is never loaded, so unsynced surveys are overwritten
`syncStore.loadOutbox()` is never called anywhere. On a cold start the in-memory outbox is `[]`. The next `enqueueSurvey` then writes `[newItem]` over `hawem_outbox_v2` in AsyncStorage (`syncStore.ts:72`). **Every survey still waiting to sync from a previous session is permanently deleted.**

### 2.3 Outbox race condition
`triggerSync` snapshots `outbox`, then replaces it with `remainingItems` when it finishes (`syncStore.ts:137`). A survey enqueued while a sync is running is not in the snapshot, so it is dropped.

### 2.4 Failed photo uploads are submitted as local file paths
In `syncStore.ts:94-108`, if `uploadAnimalPhoto` fails, `storage_path` stays as the device-local `file://` URI and the bundle is still pushed. The server stores a path that points to nothing, and the photo is never retried.

### 2.5 Hard-coded and dropped scientific fields
`StructuredSurveyScreen.tsx:573` sends `body_condition_score: 3` for **every** observation, whatever the user entered. The payload also omits observer GPS, bearing, estimated distance, GPS accuracy and timezone. CLAUDE.md §1.4 requires all of these; only the derived animal point is sent.

`start_time` is back-computed as `now − elapsedSeconds` (`:608`). That is wrong whenever the survey was paused.

### 2.6 GPS failure fabricates effort
`gpsMode` defaults to `'simulated'` (`:157`). If permission is denied or `watchPositionAsync` throws, the timer loop adds 1.5 m of distance per second (`:289`). The survey is submitted as real, with no flag. A volunteer indoors can "walk" 5.4 km per hour. That corrupts effort data and XP.

**Fix:** Delete the simulated mode from production builds. A survey without a GPS fix should stay in `acquiring_fix` with a clear UI message.

### 2.7 Raw GPS is discarded, which violates CLAUDE.md §1.5
Fixes with accuracy above 35 m are dropped with `return` (`:224`), not stored with a `rejected_reason`. Accepted points are stored as bare `[lat, lon]` with no timestamp, accuracy, speed or mock flag. Only the Douglas-Peucker-simplified line is uploaded. The `track_points` table in migration 000004 is the right destination, but nothing writes to it.

Other problems in the same code:
- The track is seeded with a Tunis coordinate (`:156`).
- The speed filter allows 144 km/h (`:247`), against the 15 km/h rule in CLAUDE.md §2.2.
- There is no background location, so tracking stops when the screen locks.

### 2.8 Consent is bypassed
`App.tsx:50` initialises `consentAccepted` to `true`, so `ConsentScreen` is never shown. For a worldwide app collecting location data, that is a GDPR/LGPD/CCPA exposure, not just a UX gap.

---

## 3. P0 — Backend cannot be reproduced from the repo

### 3.1 `submit_survey_bundle` does not exist
Every sync path calls `supabase.rpc('submit_survey_bundle')` (`services/supabase.ts:115`). No migration defines it. It only exists if someone created it by hand in the hosted project's SQL editor. A fresh environment (staging, a contributor's machine, a disaster recovery) would reject every survey.

### 3.2 Migration 000004 conflicts with 000001
Migration 000001 creates `sessions`, `observations`, `individuals`, `photos` and `routes` with v1 columns (`observer_id`, `start_time`, `location_public`). Migration 000004 then runs `CREATE TABLE IF NOT EXISTS` on the same names with v2 columns (`user_id`, `started_at`, `animal_location`, `validation_status`). The v2 definitions are therefore **silently skipped**.

000004 then creates policies that reference v2-only columns:
- `auth.uid() = user_id` (`:345`)
- `validation_status = 'valid'` (`:348`)

Those statements fail with `column does not exist`, so **the migration chain cannot apply on a clean database.** The production schema is whatever was hand-patched, and nobody can say from the repo what it is.

### 3.3 The v2 design undoes the privacy split
The v2 `observations` table stores the precise `animal_location` in the main table, and a policy lets every authenticated user read all rows (`000004:357`). Migration 000006 then grants `SELECT` on `observations` and `photos` to `anon` (`000006:17-18`). The v1 `observation_locations_restricted` design was correct, and the v2 design reverses it.

### 3.4 The functions CLAUDE.md relies on do not exist
There is no `supabase/functions/` directory. `validate_session` (the anti-cheat check, CLAUDE.md §2.2) does not exist. Nothing ever sets `validation_status`.

**Fix (Sprint 1, blocking):** Squash all six migrations into one baseline that matches the intended v2 schema, with the privacy split restored. Add `submit_survey_bundle` as an idempotent `SECURITY DEFINER` RPC keyed on `session.id`. Verify the whole chain in CI with `supabase db reset` and pgTAP.

---

## 4. P1 — Security, privacy and integrity

| # | Finding | Evidence | Fix |
|---|---|---|---|
| 4.1 | EXIF scrubber is a no-op; photos keep their GPS | `services/exifScrubber.ts:21-33` returns the input URI. It is also never called. | Re-encode with `expo-image-manipulator` before upload, and add a test that asserts the output has no GPS tag. |
| 4.2 | Photo bucket is public, and the app stores `getPublicUrl` links | `000005:14`, `storageService.ts:72,153` | Make the bucket private, issue signed URLs only for moderated photos, and keep a separate public derivatives bucket. |
| 4.3 | `anon` can `SELECT` raw `observations` / `photos` | `000006:17-18` | Revoke. Expose only the aggregated `get_public_density_map`. |
| 4.4 | Supabase anon key hard-coded as a fallback and committed in `eas.json` | `services/supabase.ts:10-13`, `eas.json` | Anon keys are public by design, but move them to EAS env vars so they can be rotated without a release. |
| 4.5 | Gemini key shipped in the bundle; wrong model hard-coded | `geminiVision.ts:115,125` builds a `gemini-1.5-flash` URL whatever `model` is passed. | Proxy through an Edge Function with per-user quotas, and validate the response with `zod` (already a dependency, unused). |
| 4.6 | Mapbox token interpolated into WebView HTML, GL JS loaded from CDN | `InteractiveMapView.tsx:178,374` | Resolved by the MapLibre migration (§8). |
| 4.7 | XP, levels and badges exist only in AsyncStorage | `gamificationStore.ts:234-250` | Make XP server-authoritative, written to `xp_events` by the bundle RPC after validation. |
| 4.8 | XP is farmable | `StructuredSurveyScreen.tsx:494` gives at least 10 XP for a 0-second survey, and +20 for "complete". | Require minimum effort (for example ≥5 min and ≥200 m, or ≥5 min stationary). Weight XP by distance and duration as CLAUDE.md §2.1 says. |
| 4.9 | The leaderboard is fake | `ProgressScreen.tsx:119` shows every other user as `0.0 km`, so the current user is always #1. | Use a server view ranked by validated km and complete checklists. |
| 4.10 | No mock-location detection | No `mocked` checks anywhere | Record `coords.mocked` (Android) per point, and flag the session server-side. |
| 4.11 | No account deletion or data export | — | Needed for App Store rule 5.1.1(v) and GDPR. Anonymise, don't destroy (see `TECHNICAL_REVIEW.md` §3.5). |

---

## 5. UX / UI audit

### 5.1 Information architecture
The current structure is five custom tabs (Map, Survey, Animals, Progress, Profile), plus a hidden Map ↔ "Dashboard" (HomeScreen) toggle inside the Map tab. Four more flows (Opportunistic, Guided photo, Training, Settings) are drawn as full-app replacements.

Problems:
- **No navigation stack.** There is no back gesture, no Android back button handling, no deep links and no state restoration. Every "modal" is an `if` in `App.tsx`.
- **The Home dashboard is undiscoverable.** It is a mode of the Map tab, re-tapping the tab exits it, and the only entry points are buttons inside other screens.
- **"Survey" is a tab, but it is really a mode.** While you survey, the tab bar stays visible and becomes a data-loss trap (§2.1).
- **Progress and Profile split one concept** (me: stats, badges, account) across two tabs.
- **The Map shows only your own device-local sightings.** No community data is fetched, so a new user sees an empty map anywhere in the world.

### 5.2 Visual system
- **1,002 hex literals (108 distinct colours).** Two token modules (`theme/ios.ts`, `design-system/tokens.ts`) are used by only a fraction of files. `themeStore` night colours reach only 6 files, and `app.json` forces `userInterfaceStyle: "light"`, so **dark mode effectively does not exist**.
- **The type scale is inverted for a field app.** The most common sizes are 11 pt (59 uses), 12 (53), 10 (44) and 13 (39). There are 18 uses of 8–9 pt. HIG body text is 17 pt. Volunteers read this outdoors, in sunlight, while walking. There is no Dynamic Type support, because every size is a fixed number.
- The custom pill tab bar (`App.tsx:638` onward) hard-codes `#0F172A` / `#94A3B8`. It does not respect theme, and it does not get native Liquid Glass on iOS 26.
- There are 15 files using RN `Modal` with bespoke headers. Past bugs were fixed with sticky headers and scroll views (see git log `ce74dc5`). Native sheets avoid that class of bug.
- The splash/home carries 14 MB of assets, including three MP4s and a 1.8 MB GIF. A further 25 MB of source media sits in `icons and illustrations/` in git. All of it inflates the app size and the cold start.

### 5.3 Accessibility
- There are 9 `accessibilityLabel`s against 187 `TouchableOpacity`/`Pressable`. Icon-only buttons (the dial, map controls, close buttons) are silent to VoiceOver and TalkBack.
- Nothing supports Dynamic Type or font scaling.
- Colour-only status (GPS quality, off-route) has no text or shape redundancy.
- Nothing honours reduce-motion, even though there are animated hero banners and video.

### 5.4 Core flow friction (measured by reading the code)
- **Logging an in-survey sighting** goes through a modal with species, identifier, group size, a 1,037-line bearing/distance dial, notes, photos, a matcher, then welfare. That is roughly 8 interactions for the most frequent action. Field apps target **2 taps plus optional detail**.
- **Ending a survey** goes through an end modal, then a summary modal, then finalize. The eBird "did you record every animal?" question is the scientifically important one, but it is buried.
- **Onboarding:** auth → (skipped) consent → dropped straight onto an empty map. There is no permission priming, no protocol explainer and no "first survey" guidance.

---

## 6. Target UX: information architecture and key flows

### 6.1 New structure (Expo Router)

```
app/
  _layout.tsx                  Stack root (auth + onboarding gates)
  (onboarding)/                welcome → how it works → permissions priming → consent
  (tabs)/_layout.tsx           NativeTabs: Explore · Animals · Record(+) · Activity · Me
    explore/index.tsx          community map + density, viewport-queried
    animals/index.tsx          known individuals & colonies (FlashList)
    activity/index.tsx         my surveys, sync status, drafts
    me/index.tsx               profile + progress + badges + settings (merged)
  record/                      presented as formSheet from the (+) tab
    index.tsx                  choose: Transect · Point count · Quick sighting
  survey/[id]/                 fullScreenModal — tab bar unreachable
    index.tsx                  live map + glass HUD
    sighting.tsx               formSheet, detents [0.4, 0.9]
    finish.tsx                 checklist question → summary → submit
  sighting/[id].tsx            detail (deep-linkable: hawem://sighting/:id)
  animal/[id].tsx
  academy/…                    training modules
```

Principles:
- **Recording is a mode, not a tab.** The (+) tab opens a sheet. An active survey is a full-screen route with no tab bar. If the app is killed, the next launch goes straight back to the survey (restored from SQLite).
- **Four real tabs plus one action**, the pattern Strava, iNaturalist and Merlin users already know.
- **Me** merges Progress and Profile. Settings becomes a pushed screen, not a full-app swap.

### 6.2 Live survey screen (the most important screen)
Modelled on workout apps, because that is what a transect is:
- A full-bleed map with a live track line and the user puck. Controls sit in a Liquid Glass (`GlassView`) HUD showing time, distance, sightings and GPS quality (always with a text label).
- Two large species buttons, **Cat** and **Dog**, at least 64 pt, in the thumb zone. One tap logs a sighting at the observer position with the compass bearing captured automatically. A sheet then offers optional detail (distance slider, group size, body condition, photo). If the sheet is ignored, the sighting is still saved.
- Pause and Finish are long-press actions, so they cannot be triggered by accident from a pocket.
- **Lock screen / Dynamic Island Live Activity** (iOS) and an **ongoing foreground-service notification** (Android) show elapsed time, distance and count. The Android notification is required for background GPS anyway.
- Haptic tick per sighting; stronger haptic on off-route or poor-GPS warnings.

### 6.3 Finish flow
1. A full-screen question: **"Did you record every cat and dog you saw?"** Yes / No, with one sentence of why it matters. A complete checklist with zero animals is celebrated equally.
2. A summary card: route, time, distance, sightings and XP breakdown (effort-first).
3. Save. The survey is written to the local outbox, and a sync status chip appears in Activity.

### 6.4 Onboarding
Three short screens: what Hawem is, how a transect works (a 10-second animation), and why effort matters. Then **permission priming** screens before each OS prompt (location while-in-use, then background location with an explanation, then camera). Then consent (real, stored server-side with a version). Then an optional 2-minute Academy module. Then the first survey.

### 6.5 Empty and offline states
Every list and map needs three states: loading (skeleton), empty (an illustration plus one action), and offline (the "saved on device, will sync" banner with a pending count). The existing cat/dog illustrations are good. Use them here instead of on a video-heavy home screen.

---

## 7. Design system: library choice and spec

### 7.1 Decision
CLAUDE.md mandates Apple HIG and Liquid Glass on both platforms. In 2026 the cheapest way to get that is to **use native components where Expo exposes them, and a thin token-driven layer for everything else**. Hand-drawing iOS chrome in JS, as the `IOS*` components do now, is the most expensive option.

| Layer | Pick | Why |
|---|---|---|
| Navigation chrome | **Expo Router `NativeTabs` + native stack** | You get a real `UITabBar`/`UINavigationBar` with Liquid Glass on iOS 26 and Material 3 navigation on Android. It replaces `IOSNavigationBar` and the custom pill tab bar. |
| Glass surfaces | **`expo-glass-effect` (`GlassView`)** | Native `UIGlassEffect` on iOS 26, with a blur fallback. Use it for the survey HUD and map controls. |
| Sheets | **Router `formSheet` presentation with `sheetAllowedDetents`** | Native detents, grabber and keyboard handling, and none of the RN `Modal` cut-off bugs. `@gorhom/bottom-sheet` v5 only for the map-anchored sheet on Explore. |
| Native controls | **`@expo/ui`** (SwiftUI / Jetpack Compose) | Pickers, switches, segmented controls, context menus and sliders that are pixel-exact on each platform. They replace `IOSSegmentedControl` and custom toggles. |
| Styling + tokens | **NativeWind v4 + React Native Reusables** (mobile), **Tailwind v4 + shadcn/ui** (dashboard) | One Tailwind token vocabulary across both apps, generated from a single `packages/design-tokens`. It replaces `theme/ios.ts`, `design-system/tokens.ts` and the 1,002 literals. It supports dark mode through CSS variables. Reusables gives accessible primitives (Button, Card, Dialog, Toast) that you own. |
| Icons | **`expo-symbols`** (SF Symbols on iOS) **+ `lucide-react-native`** (Android and web) behind one `<Icon name>` component | This satisfies CLAUDE.md §3.3 and replaces the 408-line hand-drawn `IOSIcon.tsx`. The dashboard already uses `lucide-react`. |
| Motion | **Reanimated 4 + Gesture Handler** | UI-thread animation for the dial, sheets and HUD. Honour `useReducedMotion`. |
| Lists | **FlashList v2** | Animals, Activity and review lists that stay smooth on low-end Android. |
| Images | **`expo-image`** | Caching, blurhash placeholders and memory safety for photo grids. |
| Type | System fonts (SF Pro / Roboto Flex) through a HIG-named scale | `largeTitle 34 · title1 28 · title2 22 · title3 20 · headline 17 semibold · body 17 · callout 16 · subhead 15 · footnote 13 · caption 12`. Nothing below 12. `allowFontScaling` stays on and is capped with `maxFontSizeMultiplier` only on the HUD. |

Tamagui (recommended in `TECHNICAL_REVIEW.md` §6.1) is **not** carried forward. Its main advantage is compile-time styles, and NativeWind v4 gives most of that too. Tamagui's own component set also competes with native `@expo/ui` controls, and it would leave the dashboard on a different vocabulary. Tailwind on both sides wins on team velocity.

### 7.2 Token spec (single source: `packages/design-tokens`)
- **Colour roles, not hex values:** `bg`, `bg-elevated`, `surface-glass`, `label`, `label-secondary`, `label-tertiary`, `separator`, `accent`, `accent-contrast`, `cat`, `dog`, `success`, `warning`, `danger`, `gps-good/fair/poor`. Each role has light and dark values. Every label/background pair is checked at ≥4.5:1 (≥7:1 for HUD text) by a unit test.
- **Brand:** keep the warm porcelain background and the sunset gradient as *brand moments* (onboarding, summary, badges), not as the default screen background. Working screens use neutral system backgrounds so the map, photos and data carry the colour.
- **Spacing:** the 8-pt grid (`1 = 4, 2 = 8, 3 = 12, 4 = 16, 6 = 24, 8 = 32`). Radius: `sm 8 · md 12 · lg 20 · full`.
- **Touch:** a 44 pt minimum, enforced by a `hitSlop` default in the Pressable wrapper. Primary field actions are at least 56–64 pt.
- **Elevation:** at most two levels. Glass is only for elements floating over the map.

### 7.3 Dashboard UI
- Move to Tailwind v4 through the Vite plugin (the current CDN script in `index.html:7` is dev-only).
- Add shadcn/ui for components, TanStack Query for data, TanStack Table for the review queue and exports, and MapLibre GL + deck.gl `H3HexagonLayer` for the map.
- Remove the emoji at `App.tsx:47`, which violates CLAUDE.md §3.3.
- Upgrade to React 19 to match mobile.
- Build it as a researcher console: a global filter bar (country, date range, species, protocol, validation status) that applies to every view.

---

## 8. Architecture and tooling roadmap

| Concern | Now | Target |
|---|---|---|
| Local data | 10+ AsyncStorage keys (`hawem_sightings_*`, `hawem_stats_*`, `hawem_outbox_v2`, …) | **`expo-sqlite` + Drizzle** (both already installed, unused), with the schema from `db/sqliteClient.ts`. One transactional outbox table. Raw `track_points` stored locally. |
| Sync | Ad-hoc `for` loop, no backoff, never loaded | An outbox worker: idempotency key = session UUID; exponential backoff; photos as separate resumable jobs; triggered by NetInfo, app foreground and `expo-background-task`; "Wi-Fi only" setting actually honoured (it is currently ignored). |
| Server state | Ad-hoc `supabase.from()` in screens | **TanStack Query** (already installed, unused) with generated Supabase types (`supabase gen types`). |
| Client state | 40 `useState` hooks per screen, dead stores | Zustand stores that are actually used (survey, session). Split screens into feature folders of 200–300 lines. |
| Location | Foreground-only `watchPositionAsync` | `expo-location` `startLocationUpdatesAsync` + `expo-task-manager`. Every fix is kept, with accuracy, `mocked` flag and `rejected_reason`. |
| Map | WebView + Mapbox GL JS from CDN, 844 lines, centred on Tunis | **MapLibre React Native** with a self-hosted **Protomaps** basemap. Clustered `ShapeSource`, H3 density fill from PostGIS, viewport-bounded queries. The initial camera uses the last position, then the device location, then a world view. |
| Photos | Original file, public URL | `expo-image-manipulator` re-encode (EXIF stripped, longest side 1600) → private bucket → signed URLs. |
| AI assist | Client-side Gemini key | A Supabase Edge Function `analyze-photo` with quotas and a `zod`-validated response. |
| Server validation | None | Edge Function `validate_session`, run from the bundle RPC. It checks speed, teleports, mock flags and minimum effort, and sets `validation_status`. |
| Global data | Governorate fields, Tunis defaults | `country_code`, `admin1_code` and an IANA `tz` resolved in PostGIS on insert (Natural Earth + timezone polygons). Units are localised at display only. |
| Monorepo | `packages/shared` duplicated into `apps/mobile/src/shared` | Proper Metro workspace resolution. Delete the copy. Add Turborepo. |
| Quality | No lint, no CI | ESLint 9 flat config + Prettier; GitHub Actions running typecheck, test, `supabase db reset` + pgTAP, and Gitleaks. `knip` for dead code. |
| Observability | 41 `console.*` calls | Sentry for Expo (crash reports only, no behavioural analytics). |
| Delivery | Store builds only | `expo-updates` channels (`preview`, `production`); EAS Workflows for build and submit. |
| E2E | None | Maestro flows: onboarding → survey → airplane mode → kill → relaunch → sync. |

### 8.1 Internationalisation (Arabic deprioritised)
- English is the source. Remove `ar.json`, the `I18nManager.forceRTL` path (`i18n/index.ts:31-35`), the `rankTitleAr` fields and the `isArabic` branches. Keep the `start`/`end` style convention so RTL is cheap to add back later.
- Detect the initial language with `expo-localization`, not a hard-coded default.
- French is at 98/166 keys. Add `i18next-parser` to CI and fail the build on missing keys. Priority locales after English: Spanish, Portuguese, French. Use a translation platform (Tolgee or Crowdin) so volunteers can contribute translations.
- Remove Tunisia-specific identity from the app:
  - the `TUN-OBS-` ID prefix and the "Tunisia Fauna Observatory" default organisation (`App.tsx`)
  - governorate pickers
  - the `tunisia-cat-dog-survey` slug and package names
  - the `tn.pasteur.*` bundle ID. A new store listing is needed if this ID changes, so decide early.

---

## 9. Corrections to `TECHNICAL_REVIEW.md`

| Claim there | Actual state |
|---|---|
| §3.1 "`apps/mobile/.env` and `apps/dashboard/.env` are tracked" | Not tracked. `git ls-files` shows only `apps/mobile/.env.example`, and `.gitignore` covers `.env`. The real exposure is the hard-coded fallback in `services/supabase.ts` and `eas.json`. |
| §6.1 Tamagui as the design-system foundation | Superseded by §7.1 here: native Expo UI plus NativeWind, sharing tokens with a Tailwind dashboard. |
| "Reviewed at commit `fac838b`" | That commit is not in this repository's history. |
| Missed entirely | §2.1–§2.8 (survey loss, outbox never loaded, race, fabricated GPS, hard-coded BCS, consent bypass) and §3.1–§3.3 (missing RPC, broken migration chain, v2 privacy regression). |

---

## 10. Phased implementation plan

The plan assumes one full-time developer. Each phase ends with a demonstrable exit criterion. Phases 0–2 are strictly ordered. From Phase 3 on, the work can overlap.

### Phase 0 — Stop the bleeding (3 days)
1. Show `ConsentScreen`: initialise `consentAccepted` from stored, versioned consent (§2.8).
2. Call `loadOutbox()` at startup, make `enqueue` append-safe under a mutex, and keep failed photo uploads queued instead of submitting `file://` paths (§2.2–2.4).
3. Remove the simulated GPS mode from release builds (§2.6).
4. Send the real `body_condition_score`, observer lat/lon, bearing, distance estimate and GPS accuracy (§2.5).
5. Block tab switching during an active survey as a stop-gap before Phase 2 (§2.1).
6. Make the photo bucket private, revoke the `anon` table grants, and implement a real EXIF scrub (§4.1–4.3).
7. Add a unit test for each item above.

**Exit:** start a survey → switch tab (blocked) → kill the app → relaunch → the queued survey still syncs. No photo is publicly readable.

### Phase 1 — Reproducible backend + CI (1 week)
1. Squash the migrations into one v2 baseline with the privacy split restored. Add `submit_survey_bundle` (idempotent, writes `track_points`, `observations` + restricted locations, and `xp_events`).
2. Add the `validate_session` Edge Function and the `analyze-photo` Edge Function; remove the client Gemini key.
3. Add `supabase gen types` → `packages/shared/database.types.ts`.
4. GitHub Actions: typecheck, tests, `supabase db reset` + pgTAP, Gitleaks. Add ESLint and Prettier.
5. Fix the Metro monorepo setup and delete `apps/mobile/src/shared`.

**Exit:** a fresh `supabase db reset` followed by the E2E survey submit is green in CI.

### Phase 2 — Offline-first capture engine (2 weeks)
1. Move to SQLite + Drizzle: sessions, track points, observations, photos and the outbox. Migrate the AsyncStorage data once.
2. Wire in `surveyStore` as the single source of truth, persisted on every transition, with crash recovery into the `recovered` state.
3. Background location with `expo-task-manager`, with an Android foreground-service notification. Keep every fix, including rejected ones.
4. An outbox worker with NetInfo, backoff, resumable photo jobs and the Wi-Fi-only setting.
5. TanStack Query for all server reads.

**Exit:** a 3 km airplane-mode transect with the screen locked and a force-quit mid-walk produces a complete track and all sightings, and they sync on reconnect.

### Phase 3 — Navigation and design-system foundation (1.5 weeks)
1. Adopt Expo Router with the structure in §6.1: `NativeTabs`, the native stack, `formSheet` sheets and deep links.
2. Create `packages/design-tokens` and set up NativeWind + React Native Reusables. Enable dark mode (`userInterfaceStyle: "automatic"`).
3. Add the `<Icon>` component (`expo-symbols` + Lucide), `expo-glass-effect`, `@expo/ui` controls, Reanimated 4, FlashList and `expo-image`.
4. Add the HIG type scale with Dynamic Type, plus the contrast unit test.
5. Delete `components/ios/*`, `theme/ios.ts` and `design-system/tokens.ts` as screens migrate.

**Exit:** zero hex literals outside `design-tokens`; VoiceOver and TalkBack can complete a survey.

### Phase 4 — Screen redesigns (2.5 weeks)
In priority order:
1. **Live survey** (§6.2): glass HUD, two-tap sighting, long-press finish, Live Activity / ongoing notification.
2. **Finish flow** (§6.3).
3. **Onboarding + permission priming** (§6.4).
4. **Explore:** the MapLibre + Protomaps migration, community density, viewport queries, initial camera from the user's location.
5. **Activity** (drafts, sync state), **Animals** (FlashList, detail route), **Me** (merged progress and profile, real server leaderboard).
6. Replace the video and GIF home assets with lightweight Lottie or static illustrations. Move the source media out of git (Git LFS or a design drive).

**Exit:** logging a sighting takes ≤2 taps; cold start is under 2 s on a reference low-end Android (for example a Galaxy A15); app download is under 40 MB.

### Phase 5 — Global readiness (1 week)
1. Resolve `country_code`, `admin1_code` and the IANA `tz` in PostGIS; remove the governorate fields.
2. Localise units at display (km/mi, m/ft); storage stays metric.
3. Use `expo-localization` detection; remove Arabic; get French/Spanish/Portuguese to 100%; enforce the missing-key gate in CI.
4. Add `export_my_data` and `delete_my_account` RPCs and an in-app "Delete account" (App Store requirement).
5. Rename the slug and package identifiers (decide on the store identity first).

### Phase 6 — Dashboard and science outputs (1.5 weeks)
1. Tailwind v4 (Vite plugin), shadcn/ui, TanStack Query/Table and React 19.
2. A global filter bar; the MapLibre + deck.gl H3 map; a photo review queue with keyboard shortcuts.
3. Versioned Darwin Core Archive export checked against the GBIF validator; SECR and Distance exports with a data dictionary.

### Phase 7 — Hardening and release (1 week)
1. Sentry, `expo-updates` channels and EAS Workflows.
2. Maestro E2E suites (onboarding, survey offline/kill/resync, photo, export).
3. A performance pass: bundle analysis, Hermes profiling, a FlashList audit, image memory.
4. An accessibility audit pass (Accessibility Inspector, Android Accessibility Scanner).

**Total: about 11 weeks** to a globally releasable v2.

---

## 11. Success metrics to track after launch

| Metric | Target |
|---|---|
| Surveys lost between finish and server insert | 0 (measured by comparing outbox IDs to server IDs) |
| Sessions with `validation_status = 'flagged'` | <3% |
| Share of complete checklists | >70% of surveys |
| Share of zero-animal complete surveys still submitted | Should be non-zero. If it is zero, the UI is discouraging non-detections. |
| Median taps to log a sighting | ≤2 |
| Crash-free sessions | ≥99.5% |
| Cold start (p50, low-end Android) | <2 s |
| Day-30 volunteer retention | Baseline, then +20% after the Phase 4 redesign |

---

## 12. Dependency changes

```bash
# mobile — add
expo-router expo-glass-effect @expo/ui expo-symbols expo-localization \
expo-image expo-image-manipulator expo-task-manager expo-background-task \
expo-updates @react-native-community/netinfo \
react-native-reanimated react-native-gesture-handler react-native-worklets \
@shopify/flash-list nativewind tailwindcss lucide-react-native \
@maplibre/maplibre-react-native @sentry/react-native

# mobile — already installed, start using
expo-sqlite drizzle-orm @tanstack/react-query zod zustand

# mobile — remove after migration
react-native-webview expo-linear-gradient (keep only if brand gradients stay) expo-video (home hero)

# dashboard
tailwindcss @tailwindcss/vite @tanstack/react-query @tanstack/react-table \
maplibre-gl deck.gl @deck.gl/geo-layers react@19 react-dom@19   # + shadcn/ui via its CLI

# workspace
eslint eslint-config-expo prettier husky lint-staged knip turbo i18next-parser
```
