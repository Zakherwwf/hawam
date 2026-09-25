# Prompt for Claude Code — Citizen-Science Mobile App for Free-Roaming Cats & Dogs in Tunisia (v2)

> Paste everything below the line into Claude Code in an empty project folder. Start in **plan mode** so Claude Code proposes the architecture and waits for approval before writing code. Scope: **mobile app only** (plus only the backend pieces the app needs). The researcher/admin web platform is out of scope for now.

---

## 1. Product context

We are building a citizen-science mobile app for Tunisia. People record the free-roaming cats and dogs they encounter: species, photos, location, condition, and the route they walked. **The app does not estimate population size.** It collects analysis-ready data that researchers will later use with established statistical methods:

| Method | What the app must capture for it |
|---|---|
| Photographic capture-recapture / mark-resight | Standardized photos per animal (left flank, right flank, face) + links between sightings of the same individual |
| Distance sampling | The walked track (transect) + estimated distance and bearing from observer to each animal |
| Occupancy & N-mixture models | Repeat visits to the same routes/areas + survey effort + **non-detections** (surveys where nothing was seen) |
| Spatially explicit capture-recapture (SECR) | Individual identity + precise animal locations + the surveyed track |

The scientific rule behind the whole design: **every observation must carry effort metadata** (who, when, how long, which track) and structured surveys must be able to record **zero sightings**, following the eBird "complete checklist" model. Casual sightings are welcome but are stored as a separate protocol type.

Precise locations of animals are fully stored and visible in the app. (Observers' own tracks near their homes are still protected with privacy zones — see §11.)

## 2. Core features (mobile)

1. **Structured survey** ("Survey Walk"): start a session, GPS track records in the background like a fitness app, log animals along the way, finish with "Did you record every animal you saw?".
2. **Quick sighting**: log a single animal in under 20 seconds (photo + auto GPS + species).
3. **Fixed routes**: browse and walk predefined routes; repeat them over time; "adopt a route".
4. **Map**: Mapbox map of sightings, known individuals, routes, surveyed coverage (hex grid), heatmaps, offline maps.
5. **Known animals / resighting**: animal profiles with sighting timeline; when logging an animal, the app shows known individuals nearby so the user can say "this is the same cat".
6. **Guided ID photo capture**: left flank, right flank, face, with quality checks.
7. **Georeferencing**: compute the animal's own location (not just the observer's) from bearing + distance; attach admin units (governorate, delegation) offline; spatial indexing.
8. **Gamification**: XP, levels, badges, quests, weekly streaks, exploration fog-of-war, animal collection, leaderboards, teams, synchronized community counts — designed so it rewards scientific effort, not inflated counts (see §10).
9. **Field Academy**: short training modules + quizzes (body condition scoring, distance estimation, ID photos, survey protocol); completing it unlocks "Trained Surveyor" status.
10. **Welfare alert**: flag an injured or sick animal; the record gets a priority flag and can be shared with partner NGOs.
11. **Colonies & feeding points**: mark cat colonies and feeding stations as persistent map features.
12. **Offline-first**: everything works without connectivity, including maps of downloaded areas; sync later.
13. **Trilingual**: Arabic (RTL, default), French, English.

## 3. Tech stack (defaults — verify current stable versions in official docs before installing; propose alternatives only with a strong reason)

| Concern | Choice |
|---|---|
| App framework | React Native + **Expo** (TypeScript, strict), **development builds** (not Expo Go — native modules are required), Expo Router for navigation |
| Platforms | iOS and Android. Design language = Apple HIG on both (see §12); Android adaptations where platform conventions require (back gesture, permissions, notifications) |
| Maps | **Mapbox** via `@rnmapbox/maps` (Mapbox Maps SDK v11+), offline tile packs, Mapbox Search/Geocoding API for place search |
| Location & tracking | `expo-location` + `expo-task-manager` for background location; Android foreground service with persistent notification; iOS background location mode |
| Heading | Device compass (`expo-location` heading / magnetometer) for bearing to animal |
| Camera | `react-native-vision-camera` (guided capture, frame processors for quality checks) |
| Local database | SQLite (`expo-sqlite` or `op-sqlite`) + **Drizzle ORM** with migrations |
| Sync | Custom outbox-based sync engine (§8) against Supabase |
| Server state | TanStack Query |
| Client/UI state | Zustand |
| Validation | Zod schemas shared between forms, local DB and API payloads |
| Spatial on device | `@turf/turf` (distance, bearing, destination point, point-to-line distance, simplification), `h3-js` (hex indexing) |
| Backend | **Supabase**: Postgres + **PostGIS**, Auth, Storage (resumable TUS uploads), Edge Functions, Realtime (leaderboards/community goals) |
| Push notifications | Expo Notifications |
| Crash & performance | Sentry |
| i18n | `i18next` + `react-i18next`, ICU plurals (Arabic has 6 plural forms), `I18nManager` for RTL |
| Testing | Jest + React Native Testing Library (unit/integration), **Maestro** (E2E), GPX replay for tracking tests |
| CI/CD | EAS Build, EAS Submit, EAS Update (OTA) with channels `development` / `preview` / `production` |

Mapbox token handling: public token in app config (scoped, URL/bundle restricted), secret download token only in EAS secrets. Check Mapbox's current mobile pricing/free tier and flag any cost implications to me.

## 4. System architecture

```
┌──────────────────────────── Mobile app (Expo / React Native) ────────────────────────────┐
│  UI layer        Screens (Expo Router) · HIG design system components · Mapbox views      │
│  Feature layer   survey · sighting · map · animals · gamification · academy · profile     │
│  Domain layer    entities · Zod schemas · scoring rules (client preview) · geo utilities   │
│  Data layer      Drizzle repositories · SQLite · Outbox · Photo upload queue · Sync engine │
│  Services        LocationService · TrackRecorder · HeadingService · CameraService           │
│                  GeoReferencer · OfflineMapManager · NotificationService · Telemetry       │
│  Platform        Background tasks · Foreground service (Android) · Live Activity (iOS)     │
└───────────────┬───────────────────────────────────────────────────────────┬───────────────┘
                │ HTTPS (supabase-js, RPC)                                   │ Mapbox SDK
┌───────────────▼────────────────── Supabase ─────────────────┐    ┌─────────▼──────────┐
│ Auth · Postgres + PostGIS · RLS · Storage (TUS, photos)     │    │ Mapbox tiles,      │
│ RPC: sync_push, sync_pull, nearby_individuals, hex_coverage │    │ offline packs,     │
│ Edge Functions: award_points, validate_session (anti-cheat),│    │ search/geocoding   │
│   leaderboards, quests rotation, push dispatch              │    └────────────────────┘
│ Scheduled jobs: leaderboard refresh, streak evaluation      │
└─────────────────────────────────────────────────────────────┘
```

Principles:
- **Local database is the source of truth on device.** UI reads from SQLite (reactive queries), never directly from the network.
- **Server is authoritative for gamification** (XP, badges, leaderboards) to prevent cheating; the client shows optimistic previews.
- **Every write is an idempotent, client-generated UUIDv7 record**, so retries never duplicate data.
- **Raw data is never destroyed**: raw GPS points are kept even if simplified tracks are displayed.

## 5. Project structure

```
app/                         # Expo Router routes
  (onboarding)/              # welcome, language, permissions, consent, academy intro
  (tabs)/
    map/                     # Explore map
    survey/                  # Start / active survey
    animals/                 # Known animals & collection
    progress/                # XP, badges, quests, leaderboards
    profile/                 # settings, privacy zones, offline maps, sync status
  sighting/[id].tsx          # sighting detail
  animal/[id].tsx            # animal profile
  capture/                   # guided photo capture flow (modal)
src/
  design-system/             # tokens, typography, colors, materials, components, icons
  features/
    survey/ sighting/ map/ animals/ gamification/ academy/ welfare/ colonies/ profile/
  services/
    location/ tracking/ heading/ camera/ georef/ maps/ notifications/ telemetry/
  data/
    db/ (schema.ts, migrations/) repositories/ sync/ (outbox.ts, pull.ts, push.ts, photoQueue.ts)
  domain/                    # entities, zod schemas, enums, scoring rules
  i18n/ (ar.json, fr.json, en.json)
  lib/                       # geo utils, uuid, dates, logging
assets/ (geo/tn_admin_boundaries.geojson, academy/, illustrations/)
supabase/ (migrations/, functions/, seed.sql, tests/)
e2e/ (maestro flows, gpx fixtures)
docs/ (ARCHITECTURE.md, DATA_DICTIONARY.md, GAMIFICATION.md, DESIGN_SYSTEM.md)
CLAUDE.md
```

## 6. Location, georeferencing and spatial model

**Coordinate system:** WGS84 (EPSG:4326) everywhere; PostGIS `geography(Point,4326)` / `geography(LineString,4326)`.

**Every GPS fix stored with:** lat, lon, horizontal accuracy (m), altitude, altitude accuracy, speed, heading, timestamp, provider, and Android **mock-location flag**.

**Observer vs. animal location (important for science):** the observer's GPS position is not the animal's position. When logging an animal the user sets:
- **bearing** — point the phone at the animal (compass) or tap the animal's position on the map;
- **estimated distance** (m) — slider with visual references (e.g. "one car length ≈ 4 m", "one building ≈ 15 m"); taught in the Academy.

The app computes the animal's location with turf `destination(observerPoint, distance, bearing)` and stores **both** observer and animal points, plus the method used (`compass`, `map_tap`, `same_as_observer`). For structured surveys it also computes **perpendicular distance from the track** (`pointToLineDistance`) for distance sampling.

**Quality gates:** warn when accuracy > 20 m; block survey start until accuracy < 30 m (with an override that is recorded); record magnetometer calibration state.

**Administrative georeferencing (offline):** bundle Tunisia administrative boundaries (24 governorates + delegations; source e.g. OCHA/HDX COD-AB — verify license and attribution). Point-in-polygon on device assigns `governorate_code`, `delegation_code`; also recomputed server-side with PostGIS.

**Spatial indexing:** H3 index for each animal location at resolution 9 (~0.1 km² cells, used for exploration/coverage) and resolution 7 (~5 km², used for regional quests/leaderboards). Store both.

**Habitat context:** user-selected habitat type, optionally pre-suggested from Mapbox land-use layer under the point (user confirms).

## 7. Track recording subsystem (TrackRecorder)

Behaves like a fitness-app workout recorder:

- **States:** `idle → acquiring_fix → recording ⇄ paused → finishing → finished` (+ `recovered` after crash). Implement as an explicit state machine.
- **Sampling:** distance filter ~5 m and time interval ~5 s while walking; adaptive (reduce frequency when stationary). Configurable for `stationary_point` protocol (no track, fixed location + timer).
- **Background:** Android foreground service with persistent notification (elapsed time, distance, animals logged, pause/stop actions). iOS background location mode + **Live Activity / Dynamic Island** showing the same stats.
- **Persistence:** each accepted point written to SQLite immediately (batched transactions) so a crash or OS kill never loses the track; on relaunch offer to resume or finish the recovered session.
- **Filtering:** discard fixes with accuracy > 30 m; discard jumps implying speed > 15 km/h for walking protocol; keep raw points in `track_points` with a `rejected_reason` rather than deleting.
- **Derived metrics:** distance (km), moving time, total duration, pace, area covered (H3 cells touched), animals per km.
- **Display:** simplified line (Douglas-Peucker) drawn live on the Mapbox map; raw stored.
- **Protocol flags:** `transect`, `stationary_point`, `incidental`; optional `route_id` when walking a fixed route, with a live "off-route" indicator (> 50 m from route line).
- **End of session:** summary sheet → `complete_session` question → weather, number of observers → save. A completed survey with zero animals is saved and rewarded (it is a valid non-detection).
- **Battery:** show estimated battery drain; low-battery auto-pause prompt.
- **Testing:** GPX replay harness to simulate walks (normal, GPS drift, tunnel dropouts, spoofed teleport) in unit tests and Maestro E2E.

## 8. Offline-first data & sync engine

- **Local schema mirrors the server schema** (Drizzle), plus sync metadata: `sync_status` (`pending | syncing | synced | failed`), `updated_at`, `server_version`, `deleted_at` (soft delete).
- **Outbox pattern:** every create/update writes the record and an outbox entry in one SQLite transaction. The sync worker pushes outbox entries in dependency order (session → observations → photos metadata → matches) via a `sync_push` RPC that performs idempotent upserts.
- **Photo queue:** photos saved to app file storage first; uploaded with **resumable TUS uploads** to Supabase Storage; retried with exponential backoff; Wi-Fi-only option in settings; generate thumbnails locally.
- **Pull:** `sync_pull(since)` returns changed reference data: routes, known individuals within the user's areas, colonies/feeding points, quests, badge definitions, leaderboard snapshots, user profile/XP.
- **Conflicts:** observations are owned by their creator (last-writer-wins on their own records); gamification state is server-authoritative (server overwrites client).
- **Triggers:** app foreground, connectivity regained (NetInfo), end of survey, background fetch.
- **UI:** global sync indicator + "Pending uploads" screen listing items and errors.

## 9. Individuals and resighting (supports capture-recapture)

- When logging an animal, query **known individuals within ~300 m** (local cache first, server RPC `nearby_individuals` when online) of the same species, shown as a horizontal card strip with their best photos.
- User picks: **"New animal"**, **"Same as [known animal]"**, or **"Not sure"**. Store as `individual_match` with `method = human`, `status = proposed`.
- Side-by-side compare view (flank to flank, same side) with pinch-zoom.
- A match is `confirmed` automatically when ≥ 2 independent users agree (configurable), otherwise stays `proposed` for later expert review.
- **Animal profile:** nickname (first identifier can suggest one), photos by angle, coat pattern, sighting timeline, map of sightings, last known condition, ear-tip/collar status, colony membership.
- Coat pattern pick list: tabby, bicolour/piebald, tortoiseshell/calico, solid black, solid other, merle/brindle (dogs), other. Solid coats flagged as "low identifiability".
- **Future-ready:** leave an interface `IndividualMatcher` so an ML re-identification service (HotSpotter/Wildbook-style) can later write `method = algorithm` proposals. Do not build ML now.

## 10. Gamification (in depth) — rewards effort and data quality, never inflated counts

**Scientific integrity rules (enforce server-side):**
1. XP for animals logged is small and capped per session; most XP comes from **effort, completeness and quality**. Otherwise users are incentivized to double-count.
2. A **complete survey with zero animals earns full effort XP**.
3. Bonus XP for **under-surveyed H3 cells** (spreads effort beyond city centres and fixes spatial bias).
4. Bonus XP for **repeating a fixed route** at a similar time of day (enables repeat-visit models).
5. Bonus for **complete ID photo sets** (left + right + face) and for filled condition fields.
6. Anti-cheat: reject XP for sessions with mock location, impossible speeds, teleports, or implausible density; daily XP cap; server validation Edge Function `validate_session`.

**XP table (starting values, store in a config table so we can tune):**

| Action | XP |
|---|---|
| Complete structured survey | 10 per 10 min walked (cap 60) |
| Survey marked complete (all animals recorded) | +20 |
| Zero-animal complete survey | same as above (no penalty) |
| Animal logged in survey | +2 (cap 20 per session) |
| Full ID photo set | +5 |
| Resighting of a known individual | +8 |
| First survey in a new H3 res-9 cell | +15 |
| Fixed-route repeat | +15 |
| Quick sighting | +2 |
| Academy module passed | +25 |
| Welfare alert (verified) | +10 |

**Levels:** 1–30 with a named rank ladder (e.g. Newcomer → Street Observer → Neighbourhood Watcher → Field Surveyor → Senior Surveyor → Field Scientist). Rank names localized, not literal translations.

**Badges (examples; data-driven definitions):** First Walk, 10 / 50 / 100 km surveyed, Night Owl (survey after sunset), Early Bird, Zero Hero (5 complete zero-count surveys), Photo Pro (25 full ID sets), Recapture Master (10 resightings), Explorer (50 new hexes), Route Guardian (same route 10 times), Governorate Pioneer (first survey in a delegation), Colony Keeper, Academy Graduate, Welfare Guardian. Use SF Symbols-style glyphs, bronze/silver/gold tiers.

**Streaks:** **weekly** streaks (at least one survey per week), not daily, to avoid burnout; one "freeze" per month.

**Quests:** 3 rotating weekly quests personalized by location (e.g. "Survey 2 hexes you've never visited", "Walk route X", "Get a full photo set of a dog"). Server-generated.

**Exploration map ("fog of war"):** H3 hex layer on the map; hexes the user has surveyed are revealed; community-surveyed hexes shown with a different tint; percent coverage of the user's delegation.

**Collection ("my animals"):** gallery of individuals the user first identified or resighted, with resight counts — like a field guide the user builds.

**Leaderboards:** by **km surveyed** and **complete surveys**, never by animal count. Scopes: friends, team, delegation, governorate, national; weekly and all-time. Users can opt out / appear anonymously.

**Teams:** schools, universities, NGOs, neighbourhoods can create teams with shared goals and a team leaderboard.

**Community events ("Great Tunisian Count"):** synchronized survey weekends — two surveys of the same area within 48 h, which is exactly the closure window needed for capture-recapture. Live community progress bar via Supabase Realtime. Event badges.

**Feedback loops:** after each survey, a shareable summary card (route, distance, animals, hexes revealed) — share image generated on device, localized. Monthly "your impact" recap (how your data contributed).

**Notifications (respectful, opt-in):** quest reminders, streak at risk, a known animal you identified was resighted, community event starting, badge earned. Quiet hours respected.

## 11. Data model (Supabase / PostGIS; mirrored locally)

**profiles**: id (auth uid), display_name, avatar, preferred_language, role (`volunteer | trained_surveyor | researcher | admin`), team_id, xp_total, level, leaderboard_visibility (`public | anonymous | hidden`), consent_version, created_at.

**privacy_zones**: id, user_id, center geography(Point), radius_m (100–1000). Track points inside a user's privacy zone are hidden from other users (protects observers' homes, like Strava). Animal observations remain visible.

**routes**: id, name_ar, name_fr, name_en, geometry LineString, length_km, governorate_code, delegation_code, difficulty, created_by, is_official.

**sessions**: id (UUIDv7), user_id, protocol (`transect | stationary_point | incidental`), route_id, started_at, ended_at, moving_time_s, duration_s, distance_m, track LineString (simplified), complete_session bool, n_observers, weather (`clear | cloudy | rain | wind | hot`), time_of_day, avg_gps_accuracy_m, mock_location_detected bool, app_version, device_model, h3_cells_res9 text[], validation_status (`pending | valid | flagged`), created_at, updated_at.

**track_points**: id, session_id, recorded_at, location Point, accuracy_m, altitude, speed, heading, provider, is_mock, rejected_reason (nullable).

**observations**: id (UUIDv7), session_id, user_id, observed_at, observer_location Point, animal_location Point, location_method (`compass | map_tap | same_as_observer`), bearing_deg, distance_estimate_m, perpendicular_distance_m, gps_accuracy_m, h3_res9, h3_res7, governorate_code, delegation_code, species (`cat | dog | unknown`), group_size, individual_id (nullable), is_welfare_alert bool, colony_id (nullable), notes, created_at, updated_at.

**observation_animals** (one row per animal when group_size > 1 and details are recorded):
- sex (`male | female | unknown`)
- age_class (`juvenile | adult | unknown`)
- reproductive_status (`lactating | visibly_pregnant | none_visible | unknown`)
- body_condition_score (ICAM 5-point, 1 very thin → 5 obese, with reference illustrations)
- health_issues text[] (`skin_lesions_mange | wound | limping | eye_nose_discharge | tumour | emaciation | none`)
- ear_tip_or_notch (`yes | no | unknown`), collar_or_tag (`yes | no | unknown`)
- behaviour (`approachable | neutral | fearful | aggressive`)
- being_fed_by_people (`yes | no | unknown`)
- coat_pattern, primary_colour
- habitat_type (`residential | commercial | market | landfill_garbage | slaughterhouse_vicinity | agricultural | beach_coastal | natural_area | other`)
- food_sources_visible text[] (`garbage | deliberate_feeding | none | other`)

**photos**: id, observation_id, storage_path, thumbnail_path, angle (`left_flank | right_flank | face | other`), width, height, blur_score, brightness_score, taken_at, upload_status. Strip personal EXIF from stored files; keep capture GPS/time in DB.

**individuals**: id, species, nickname, coat_pattern, primary_colour, identifiability (`high | low`), first_seen_at, last_seen_at, sightings_count, first_identified_by, colony_id, ear_tipped, status (`active | not_seen_recently | reported_deceased`).

**individual_matches**: id, observation_id, candidate_individual_id, method (`human | algorithm`), decision (`same | different | unsure`), user_id, status (`proposed | confirmed | rejected`), created_at.

**colonies**: id, type (`cat_colony | feeding_point | dog_pack_area`), location Point, name, created_by, notes, last_verified_at.

**Gamification tables**: `xp_events` (id, user_id, source_type, source_id, xp, reason, created_at — append-only ledger), `badge_definitions`, `user_badges`, `quests`, `user_quests`, `streaks`, `teams`, `team_members`, `events`, `event_participation`, `leaderboard_snapshots` (materialized/refreshed by schedule), `gamification_config`.

**academy**: `academy_modules`, `academy_questions`, `user_academy_progress`.

**RLS policies:**
- Everyone authenticated can read observations, individuals, photos, colonies, routes.
- Users create/update only their own sessions, observations, photos, matches.
- `track_points` of other users are readable only outside their privacy zones (enforce with a security-definer view/RPC).
- XP, badges, levels writable only by Edge Functions (service role).
- Write pgTAP or SQL tests for each policy.

## 12. Design system — Apple Human Interface Guidelines

Follow the current Apple HIG and the **iOS 27 UI Kit** (Figma: Apple Design Resources) including the **Liquid Glass** material language, on both iOS and Android.

- **Typography:** use the system font on iOS (SF Pro, and SF Arabic for Arabic — automatic via system font). **SF fonts are licensed for Apple platforms only**, so on Android use the platform system font / a close open-licence substitute (e.g. Inter + Noto Sans Arabic or IBM Plex Sans Arabic) mapped to the same HIG text styles: Large Title, Title 1–3, Headline, Body, Callout, Subheadline, Footnote, Caption 1–2. Support **Dynamic Type** / font scaling.
- **Icons:** SF Symbols on iOS (`expo-symbols`), with an equivalent open icon set on Android mapped through one `<Icon name=…>` component. Symbols must mirror correctly in RTL.
- **Colors:** semantic tokens (label, secondaryLabel, systemBackground, secondarySystemBackground, separator, tint), full light and dark mode, sufficient contrast. One brand tint colour (propose a warm, friendly colour) plus species accents (cat / dog) that are never the only carrier of meaning.
- **Materials:** Liquid Glass / translucent blur for tab bar, toolbars and map overlays where the Expo SDK supports it natively; graceful fallback to standard blur/solid on Android and older iOS.
- **Layout:** safe areas, 8-pt spacing grid, minimum 44×44 pt touch targets, large titles on top-level screens, grouped inset lists for forms (Settings-style).
- **Navigation:** tab bar with 5 tabs (Map, Survey, Animals, Progress, Profile); modal sheets with detents for sighting entry over the map (Apple Maps–style bottom sheet); native stack transitions; prefer native iOS components where Expo provides them (native tabs, context menus, sheets) and verify in the current Expo SDK docs.
- **Motion & haptics:** subtle spring animations, haptic feedback on key events (animal logged, badge earned, survey saved); honour Reduce Motion.
- **Survey screen** should feel like the Apple Fitness workout screen: large live metrics, big Start / Pause / End controls, map behind glass.
- **Accessibility:** VoiceOver/TalkBack labels on everything, Dynamic Type up to accessibility sizes, colour-blind-safe map styles.
- **RTL:** full layout mirroring in Arabic, correct number and date formatting per locale (Western Arabic numerals default, configurable).
- Put all tokens in `src/design-system/tokens.ts`; build a small component library (Button, ListRow, Section, Sheet, Chip/Segmented control, Stepper, Slider, Card, Badge, ProgressRing, MetricTile, EmptyState) and a hidden in-app **Design System Gallery** screen for review.
- Map styles: custom Mapbox light and dark styles matching the palette, Arabic/French labels by app language.

## 13. Screen map (key flows)

- **Onboarding:** language → what the project is → consent → location permission (explain why "Always" is needed for background survey) → notifications → optional quick Academy intro.
- **Map tab:** Mapbox full-screen, layer toggle sheet (my sightings, all sightings, individuals, colonies, routes, coverage hexes, heatmap), search place, offline area download, cluster tapping, sighting detail sheet.
- **Survey tab:** choose protocol / route → GPS fix screen → live survey (metrics, map, "+ Cat" and "+ Dog" big buttons, pause/stop) → animal entry sheet (species, group size, bearing & distance, photos, known-animal matcher, details progressively disclosed) → end summary → complete-session question → rewards screen.
- **Quick sighting:** floating action from map; camera → species → save (details optional later).
- **Animals tab:** my collection, nearby known animals, search by nickname, animal profile.
- **Progress tab:** level ring, XP history, badges grid, weekly quests, streak, leaderboards, team, events.
- **Profile tab:** settings, language, units, privacy zones, leaderboard visibility, offline maps manager, pending uploads, Academy, about the science, delete account.

## 14. Security, privacy, compliance

- Supabase Auth: email OTP + phone OTP (SMS widely used in Tunisia) + Sign in with Apple (required on iOS if other social logins are added) + Google.
- Consent screen and privacy policy in 3 languages; store consent version; account deletion deletes personal data and anonymizes contributions.
- Personal EXIF stripped from uploaded photos; faces of people in photos: add a "photo contains a person" flag and blur later (note as future work).
- Secrets only in EAS secrets / Supabase vault; no service keys in the app.
- Rate limiting on RPCs; server-side validation of all payloads with the same Zod-equivalent constraints.

## 15. Quality & testing

- Unit tests: geo utilities (destination point, perpendicular distance, H3, point-in-polygon), scoring rules, state machine of TrackRecorder, sync outbox ordering and idempotency.
- Integration tests: repositories against SQLite, sync push/pull against a local Supabase (`supabase start`).
- RLS policy tests.
- E2E (Maestro): onboarding, full survey with GPX replay, offline survey then sync, quick sighting, resighting match, RTL Arabic run.
- Performance budgets: cold start < 2.5 s on a mid-range Android, map at 60 fps with 5,000 points (clustering), survey recording ≤ ~8%/hour battery target (measure and report).
- Test on a low-end Android device profile — most users in Tunisia use Android.

## 16. Build phases (each ends runnable and demoable)

1. **Foundation:** Expo dev build, TypeScript strict, Expo Router tabs, design system tokens + gallery, i18n with Arabic RTL, Supabase project, migrations with PostGIS, RLS + tests, auth + onboarding.
2. **Local data & sync:** Drizzle schema, repositories, outbox, pull/push RPCs, photo queue with TUS, sync status UI.
3. **Maps:** Mapbox integration, custom light/dark styles, layers, clustering, offline packs, admin-boundary georeferencing.
4. **Quick sighting + guided photo capture** with quality checks.
5. **Structured survey:** TrackRecorder state machine, background tracking, foreground service / Live Activity, bearing & distance georeferencing, perpendicular distance, fixed routes, crash recovery, GPX replay tests.
6. **Individuals & resighting:** nearby known animals, matcher UI, animal profiles, colonies.
7. **Gamification:** XP ledger, server Edge Functions, badges, levels, quests, streaks, fog-of-war hexes, leaderboards, teams, events, share cards, notifications.
8. **Academy & welfare alerts.**
9. **Hardening:** accessibility pass, performance, battery measurements, Sentry, EAS production builds, store listings (Arabic/French).

## 17. How I want you to work

1. **Start in plan mode.** Produce `docs/ARCHITECTURE.md` (refining this design), the full SQL schema with RLS, and the phase plan. Wait for my approval before coding.
2. Before using any library, check its current documentation and Expo compatibility; tell me if something in this spec is outdated or won't work with the current Expo SDK, and propose the best replacement.
3. Create `CLAUDE.md` in the repo summarizing: the scientific data rules (effort metadata, complete sessions, zero-count surveys, animal vs. observer location, raw data never deleted), the gamification integrity rules, the design system rules, and the RTL requirement — so every future session respects them.
4. Maintain `docs/DATA_DICTIONARY.md` (every field, allowed values, and which statistical method uses it), `docs/GAMIFICATION.md` (all XP rules and anti-cheat checks) and `docs/DESIGN_SYSTEM.md`.
5. Commit at the end of each coherent step with clear messages; keep the app runnable after every phase.
6. Ask me before adding any paid service, or before changing the data model in a way that removes a scientific field.
