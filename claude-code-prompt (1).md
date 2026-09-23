# Prompt for Claude Code: Citizen-Science App for Free-Roaming Cats & Dogs (Tunisia)

> Paste everything below the line into Claude Code, in an empty project folder. Start in **plan mode** so Claude Code proposes the architecture before writing code.

---

## Context

I'm building a citizen-science mobile app for Tunisia. Members of the public record the free-roaming cats and dogs they encounter. **The app does not estimate population size itself.** Its job is to collect analysis-ready data that researchers (university / Institut Pasteur de Tunis / veterinary services) can later feed into established statistical methods:

- Photographic capture-recapture / mark-resight (needs individual re-identification from photos)
- Distance sampling (needs transect routes and animal distance from the route)
- Occupancy and N-mixture models (need repeat visits, survey effort, and non-detections)
- Spatially explicit capture-recapture (needs individual ID + precise locations)

For this to be scientifically valid, every record must carry **effort metadata** (who, where, when, how long, what route) and sessions must be able to record **non-detections** — the eBird "complete checklist" model. Opportunistic presence-only records are still collected but are clearly flagged as a separate data type.

## Critical ethical constraint (non-negotiable)

Free-roaming animals in Tunisia are sometimes culled or poisoned by municipalities. Precise locations of animals must **never** be publicly exposed.

- Store precise coordinates in a restricted table readable only by the `researcher` and `admin` roles.
- Anything shown to regular users or exported publicly must be generalized to a ~1 km grid cell (and record the generalization in Darwin Core `dataGeneralizations` / `informationWithheld`).
- No public real-time map of individual animals. Public maps show aggregated density per grid cell only, with a minimum-count threshold before a cell is displayed.
- Enforce this at the database level (row-level security / views), not only in the UI.
- Write tests proving a regular user cannot retrieve precise coordinates through any API path.

## Tech stack (default — propose alternatives only if you have a strong reason)

- **Mobile:** React Native with Expo (TypeScript), Android first (dominant in Tunisia), iOS compatible.
- **Backend:** Supabase (Postgres + PostGIS, Auth, Storage, Row-Level Security).
- **Offline-first:** local SQLite store on device; queue observations and photos; sync when connectivity returns; handle conflicts and partial uploads safely.
- **i18n:** Arabic (RTL, default), French, English. All strings externalized from day one. Correct RTL layout mirroring.
- **Maps:** a lightweight open map library with offline tile caching for survey areas.

## Two recording modes

### 1. Structured Survey mode (the scientific backbone)
- User starts a **session**: selects protocol (`transect` or `stationary_point`), and optionally a predefined route.
- App automatically records start time, end time, and a GPS track of the path walked (sampled every few seconds, battery-aware).
- During the session the user logs each animal seen (see observation fields below), including **estimated distance from the path** (metres) for distance sampling.
- At the end, the user must answer: **"Did you record every cat and dog you saw?"** (`complete_session` yes/no). A complete session with zero animals is a valid and important record (a non-detection).
- Support **predefined fixed routes** created by researchers, so the same route can be walked repeatedly (needed for repeat-visit models and trends).

### 2. Opportunistic mode (casual sightings)
- Quick "I saw an animal" entry: photo + auto GPS + timestamp + minimal fields.
- Flagged `protocol = incidental` so analysts can separate it from structured data.

## Data model (minimum)

**users**: id, role (`volunteer`, `trained_surveyor`, `researcher`, `admin`), preferred language, consent version accepted, created_at.

**routes**: id, name, geometry (LineString), governorate, delegation, habitat notes, created_by (researcher).

**sessions**: id, observer_id, protocol (`transect` | `stationary_point` | `incidental`), route_id (nullable), start_time, end_time, duration_min, track (LineString), distance_km (computed), complete_session (bool), number_of_observers, weather (clear/cloudy/rain/wind), time_of_day, app_version, device_gps_accuracy_avg.

**observations**: id, session_id, observed_at, location_precise (Point, restricted), location_public (1 km grid cell, derived), gps_accuracy_m, species (`cat` | `dog` | `unknown`), group_size, distance_from_path_m (nullable), and per-animal attributes (below), linked_individual_id (nullable — set later by photo-ID).

**Per-animal attributes** (use established schemes, don't invent new ones):
- sex: `male` | `female` | `unknown`
- age_class: `juvenile` (puppy/kitten) | `adult` | `unknown`
- reproductive_status: `lactating` | `visibly_pregnant` | `none_visible` | `unknown` (lactating females are an ICAM indicator of population turnover)
- body_condition_score: ICAM 5-point visual scale (1 very thin → 5 obese), with a reference illustration in the UI
- visible_health_issues: multi-select (skin lesions/mange, wound, limp, eye/nose discharge, tumour, none)
- ear_tip_or_notch: yes/no/unknown (neutering marker)
- collar_or_tag: yes/no/unknown (ownership marker)
- behaviour: approachable / neutral / fearful / aggressive
- being_fed_by_people: yes/no/unknown
- habitat_type: residential, commercial, market, landfill/garbage site, slaughterhouse vicinity, agricultural, beach/coastal, natural area, other
- food_sources_visible: garbage, deliberate feeding, none, other
- free-text notes

**photos**: id, observation_id, storage_path, angle (`left_flank` | `right_flank` | `face` | `other`), taken_at, exif stripped of personal data but GPS copied into the restricted observation record.

**individuals** (for photo-ID, populated later): id, species, coat_description, first_seen, last_seen, confirmed_by (researcher).

**individual_matches**: photo_a, photo_b, method (`human` | `algorithm`), score, status (`proposed` | `confirmed` | `rejected`), reviewer_id.

## Photo capture requirements (for individual re-identification)
- Guided capture screen asking for **left flank, right flank, and face** (coat patterns are asymmetric, so flanks are not interchangeable). Allow skipping if the animal leaves.
- Simple on-screen quality checks: warn if blurry or too dark.
- Compress for upload but keep a resolution sufficient for pattern matching (e.g. longest side ≥ 1600 px).
- Coat pattern quick-pick: tabby, bicolour/piebald, tortoiseshell/calico, solid black, solid other colour, other. (Solid-coloured animals are hard to re-identify; record this so analysts know.)

## Researcher web dashboard (simple, can come in phase 2)
- Manage fixed routes and user roles.
- Review queue for proposed photo matches (side-by-side view) to confirm/reject individual identities.
- Export data.

## Data export (for analysis)
- **Darwin Core** occurrence export (CSV / DwC-A) with `eventID`, `eventDate`, `samplingProtocol`, `samplingEffort`, `individualCount`, `sex`, `lifeStage`, `decimalLatitude/Longitude` (generalized in public export), `coordinateUncertaintyInMeters`, `dataGeneralizations`, `occurrenceStatus` (including `absent` from complete sessions with zero detections), `countryCode = TN`.
- **Capture-history export** for mark-resight / capture-recapture: one row per confirmed individual, one column per survey occasion (1/0), compatible with R packages such as `secr`, `unmarked` and Program MARK.
- **Distance-sampling export**: session effort (transect length) + detection distances, compatible with the R `Distance` package.
- Precise-coordinate exports only for the `researcher` role, and logged in an audit table.

## Privacy & consent
- Clear consent screen (Arabic/French) explaining what is collected and how locations are protected; store consent version.
- Collect minimal personal data about participants; allow account deletion.
- Strip personal EXIF metadata from stored photos.
- Never show other users' identities or tracks.

## Engagement (lightweight, MVP)
- Personal stats: sessions completed, km surveyed, animals recorded.
- Short in-app training module (5 screens) on how to do a structured survey, estimate distance, score body condition, and take ID photos.

## Out of scope for the MVP
- Automated AI species classification and automated individual re-identification. **Design the data model so these can be added later** (e.g. a service running HotSpotter/Wildbook-style matching that writes `proposed` rows into `individual_matches`), but don't build them now.
- Any population estimation inside the app.

## How I want you to work

1. **Start in plan mode.** Propose the architecture, folder structure, database schema (SQL migrations with RLS policies), and a phased build plan. Wait for my approval before writing code.
2. Build in phases, each ending in something runnable:
   - Phase 1: project setup, auth, i18n with RTL, database schema + RLS + tests for location protection.
   - Phase 2: opportunistic mode with offline queue and photo capture.
   - Phase 3: structured survey mode with GPS tracking, distance-from-path, complete-session flag, fixed routes.
   - Phase 4: exports (Darwin Core, capture-history, distance-sampling) and a minimal researcher dashboard.
3. Write tests for: offline sync, location generalization, RLS access rules, and export formats.
4. Create a `CLAUDE.md` in the repo summarizing the scientific requirements and the location-protection rule, so they're respected in every future session.
5. Keep a `docs/DATA_DICTIONARY.md` describing every field, its allowed values, and which statistical method uses it.
6. Ask me before adding any paid service or any feature that exposes location data.
