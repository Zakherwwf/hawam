# Research portal architecture (dashboard v3)

The research portal (`apps/dashboard`) is where researchers and admins read, check and curate what volunteers record in the Hawem app. It does not estimate population size (CLAUDE.md 1.1). It shows effort, detections, data quality and protocol compliance, and exports analysis-ready files.

This document covers the information architecture, every page, the data flow, the analysis rules each chart follows, the route-protocol model, the database changes, the design system and how to verify changes.

---

## 1. Goals and non-goals

**Goals**

1. Every number traceable: each chart has a table twin, each tile links to the Explore question that produced it, each record has a profile page.
2. One filter model for the whole portal (Metabase-style). A filtered view is a link.
3. Fixed routes are protocols, not just lines: start point, walking direction, side, strip width, time window, revisit interval, completeness, instructions. Every volunteer gets the same rules in the app.
4. Profiles for every entity: walk, observation, known animal, route, person, colony.
5. Scientific integrity carried into the UI: flagged sessions never count as effort, zero-animal complete checklists are real zeros, encounter rate is labelled an index, not a density, rankings use effort only.

**Non-goals**

- No population estimates, densities or home-range estimates. Ranges and distances on animal profiles describe where volunteers saw an animal and are labelled as such.
- No editing of observations or validation results from the portal. Server-side validation (`validate_session_record`) owns `validation_status`; the portal explains it.
- No hard deletion of anything that carries data. Routes that were walked can only be archived.

---

## 2. Information architecture

```
Shell
├── Rail (start side, labelled icons; bottom bar on phones)
│   ├── Analyse:  Overview · Explore · Timeline · Map
│   ├── Records:  Walks · Sightings · Animals
│   └── Manage:   Routes · People · Colonies · Exports
├── Top bar (glass): search ⌘K · active volunteers this week · New Route · review inbox · account
└── Page
    ├── Filter row (where the page is filterable)
    └── Content
```

### URL scheme (hash router, `src/lib/router.ts`)

| URL                                                                  | Page                                          |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `#/overview`                                                         | Overview                                      |
| `#/explore?m=rate&by=route&g=week&chart=line&trend=1&roll=4`         | Explore question                              |
| `#/timeline` · `#/timeline?view=feed`                                | Schedule grid · activity feed                 |
| `#/map?layers=sightings,routes,heat&base=satellite`                  | Map                                           |
| `#/walks` · `#/walks/<session id>`                                   | Walk list · walk profile                      |
| `#/sightings` · `#/sightings/<observation id>`                       | Sighting list · observation profile           |
| `#/animals` · `#/animals?view=all` · `#/animals/<individual id>`     | Review queue · known animals · animal profile |
| `#/routes` · `#/routes/<id>` · `#/routes/<id>/edit` · `#/routes/new` | Routes · route profile · editor               |
| `#/people` · `#/people/<user id>`                                    | Directory · person profile                    |
| `#/colonies?c=<id>`                                                  | Colonies (profile in a drawer)                |
| `#/exports`                                                          | Exports                                       |

`#/volunteers` (the old page) redirects to People.

**Global filter keys** (`GLOBAL_KEYS`): `range` (7d, 30d, 90d, 6m, 12m, all), `from`/`to` (custom, yyyy-mm-dd, inclusive), `sp` (comma list of cat, dog, unknown), `proto`, `status` (valid, flagged, complete, partial), `who` (user id), `route` (route id). `hrefKeep()` builds links that carry them, so drilling from a tile into Explore or Walks keeps the slice.

---

## 3. Source layout

```
apps/dashboard/src
├── App.tsx                 auth gate, page table, lazy page chunks
├── app/
│   ├── Shell.tsx           rail, top bar, keyboard shortcuts (⌘K, /)
│   └── CommandPalette.tsx  search across pages, people, animals, routes, colonies, codes, walks
├── components/
│   ├── charts.tsx          TimeChart, Sparkline, BarList, SplitBar, CalendarHeatmap,
│   │                       HourHeatmap, Columns, ChartFrame (chart/table toggle), Legend
│   ├── MapView.tsx         Mapbox map: points, lines, arrows, start/end, heatmap,
│   │                       bearing lines, draggable vertices; LazyMap.tsx code-splits it
│   ├── FilterBar.tsx       the one filter row; DateRange popover with presets + custom
│   ├── RouteThumb.tsx      SVG route shape with start, end and direction (no tiles)
│   └── widgets.tsx         useSlice(), StatusBadge, PersonChip, PhotoTile, activity feed
├── data/
│   ├── api.ts              every Supabase call and row type
│   ├── portal.ts           useCore() shared tables + name lookups; slotOf() stable colours
│   ├── useData.ts          per-visit cache keyed by string, invalidate(prefix)
│   ├── preview.ts          sample world for VITE_PREVIEW=1 (never in production builds)
│   └── flags.ts, client.ts
├── lib/
│   ├── filters.ts          Filters model, readFilters, applyFilters, previousWindow
│   ├── series.ts           metrics, buckets, series/splitSeries, linearTrend, rolling, heatmaps
│   ├── compliance.ts       route protocol checks from track + route geometry
│   ├── stats.ts, exports.ts, csv.ts, geo.ts, format.ts, labels.ts, theme.ts, router.ts
├── pages/                  one file per page (see section 4)
└── ui/index.tsx            design system components
```

---

## 4. Pages

### 4.1 Overview

- **Filter row**: date range, species, record type, route, volunteer.
- **KPI tiles** (each links to its Explore question): kilometres surveyed, complete checklists, animals counted, encounter rate. Delta against the same-length previous window (`previousWindow`), coloured by direction × whether up is good; 12-point sparkline.
- **Survey effort**: km per bucket, area chart, 4-bucket rolling mean as a dashed reference.
- **Animals by species**: stacked columns per bucket (2 px surface gaps), part-to-whole split bar, totals.
- **Encounter rate trend**: animals per km on complete transects, least-squares trend line.
- **Survey calendar**: sessions per day over 26 weeks (single-hue sequential ramp) and a weekday × hour matrix.
- **Latest activity**, **Data quality** (resightings to review, flag reasons, share of survey-walk sightings with a perpendicular distance), **Routes** (visits in period, overdue routes), **Most effort** (km only).

### 4.2 Explore (question builder)

Measure × time grain × breakdown × chart type, plus overlays. Everything is in the URL, so a question is a link; Copy Link and Download CSV are in the header.

- **Measures** (`METRICS` in `series.ts`): km, survey minutes, survey sessions, complete checklists, zero-animal checklists, sightings, animals counted, encounter rate (ratio), active volunteers (distinct), flagged sessions, welfare alerts, mean body condition (mean).
- **Grain**: day, week (Monday start), month; default chosen from the window length (`autoGrain`).
- **Breakdown**: species, record type, route, volunteer, time of day, weather. The six largest groups are drawn. Species only splits sighting-side measures; a walk is effort for every species at once, so splitting km by species would be wrong, and the page says so.
- **Chart**: line, area, grouped bars, stacked bars (disabled for ratios, means and distinct counts, which do not add), table.
- **Overlays** (single series only): linear trend with R², rolling mean over 3, 4 or 8 buckets.
- **Summary strip**: total (combined correctly per measure kind), mean per bucket, busiest bucket, trend as % of the mean per bucket with R².
- **Groups compared** table for breakdowns.

### 4.3 Timeline

- **Schedule** (reference board 2): volunteers as rows, days as columns (1, 2 or 4 weeks), weekends hatched, today highlighted. Each walk is a block coloured by state (complete, partial, quick, flagged) and opens the walk. Prev/next/today navigation; record-type, status and route filters.
- **Activity feed**: every walk, welfare alert, new known animal, confirmed resighting and route change in the window, grouped by day.

### 4.4 Map

Layers: sightings, density heatmap, walked tracks, fixed routes (arrows show direction), colonies, known animals. Base map: light, streets, satellite. Week scrubber with play/pause steps through the filtered period. Every point and line opens its profile. Arabic street names are shaped with the Mapbox RTL text plugin.

### 4.5 Walks and the walk profile

- **List**: sortable columns (start, volunteer, time, km, animals, protocol score), search by volunteer, route or note, filtered CSV download.
- **Profile**: map with the track (arrows = walking direction), start/end markers, the route as drawn, sightings, observer-to-animal bearing lines and rejected GPS fixes (kept, shown in red). Facts (pace, completeness, weather, GPS accuracy, app version). Flag reasons explained in plain language. **Route protocol** checklist (section 6). **Speed** over time with the 15 km/h limit and **GPS accuracy** with the 30 m cut-off, from raw fixes. Sightings with bearing, estimated distance and perpendicular distance. Previous/next walk by the same volunteer.

### 4.6 Sightings and the observation profile

- **List**: species split, detection-distance histogram (shape of the detection function, survey walks only), body-condition distribution, welfare-only toggle, search by code, sortable table, filtered CSV.
- **Profile**: photos; the animal (sex, age, reproductive status, coat, ear tip, collar, behaviour, ICAM body condition on a 5-step scale); health and context (health issues, distinguishing "assessed, none seen" from "not assessed"; fed by people; habitat; food sources); geometry (bearing with compass, estimated distance, perpendicular distance, GPS accuracy, animal and observer coordinates, method, public grid cell); map of observer, bearing and animal; known-animal link with status; session; per-animal rows for groups; other sightings of the same species within 150 m.

### 4.7 Animals and the animal profile

- **To review**: side-by-side new sighting vs known animal, photos sorted so the same flank shows first, distance from last known position, Same / Different / Skip, up-next list.
- **Known animals**: card grid with photo, species and coat, confirmed sightings, last seen, number of observers; search, species, sort.
- **Profile**: photo gallery filtered by angle; first/last seen, farthest apart, minimum convex polygon of confirmed sightings (labelled as where it was seen, not a home range), mean body condition, link counts; **capture history** strip (one cell per week: seen, surveyed nearby but not seen, no records); map of confirmed sightings joined in date order; encounter list with inline review.

### 4.8 Routes, route profile, route editor

See section 6 for the protocol model.

- **Routes**: map of live (orange, arrows) and paused (dashed grey) routes; tabs Live / Paused / Archived; cards with an SVG thumbnail (start, end, direction), length, direction rule, side and strip, time window, visits, walkers, mean protocol score, last walked, live switch or Restore.
- **Profile**: map with start and end, arrows, optional walked tracks; the walking protocol; live switch; visits, walkers, mean protocol score and coverage, how many visits went as drawn vs reversed; **encounter rate per visit** with trend (the comparison fixed routes exist for); visits table with version, direction, coverage and score; version history. Actions: Edit, Reverse Direction (confirm, bumps version), Archive (confirm), Restore, Delete Forever (only when never walked, confirm).
- **Editor**: click to add points; Follow Streets routes each new segment along walkable streets (Mapbox Directions, walking profile; falls back to a straight segment and says so); drag a point to move it; click a point to select it, then Delete Point, Make This the Start (loops) or Start Here Instead (end point of an open line); Reverse; Close/Open loop; Clear; Undo/Redo (⌘Z, ⇧⌘Z); Delete/Backspace removes the selected point. Live length and a duration estimate at 3 km/h. Rules form on the right. Unsaved-changes guard on close and on leaving. A notice states which protocol version the next walks will use.

### 4.9 People and the person profile

- **Directory**: cards with initials avatar (no photos of people are collected), role, 8-week km bars, km, walks, complete checklists, last surveyed, flagged count; table layout; role filter; sort by km, walks, recency or name. Ranked by effort, never animal counts (CLAUDE.md 2.3).
- **Profile**: role (admins can change it, with a confirmation that explains the access it grants), joined date, app language, last survey; km, sessions, active weeks, complete and zero-animal checklists, sightings; km per week; data-quality meters (complete share, distance recorded, not flagged) and flag reasons; calendar and hour matrix; routes walked with mean protocol score; what they recorded; known animals they registered; sessions table.

### 4.10 Colonies

Map, kind filter, totals (colonies, sterilised share where counted, not visited in 30 days), table with sterilisation meter. Drawer profile: location, facts, caretaker, feeding, sterilised share against the ~70% threshold, visit log.

### 4.11 Exports

Unchanged contracts (Darwin Core, survey effort, distance sampling, exact positions, capture histories, SECR detections), all logged through `log_export`. Walks and Sightings add filtered CSV downloads of what is on screen.

---

## 5. Data flow

```
Supabase (RLS)                     useData cache (per visit)          pages
──────────────                     ─────────────────────────          ─────
sessions (+ observer name) ──────► 'walks'      ┐
observations_map ────────────────► 'sightings'  ├─ useCore() ──► useSlice(params) ──► filtered walks + sightings
users ───────────────────────────► 'users'      │                    │                 + previous window
routes_admin | routes+routes_app ► 'routes'     ┘                    └► lib/series, lib/compliance
session_tracks_geojson ──────────► 'tracks'           (lazy: walks, map, routes, people)
individuals_app, individual_links► 'individuals','links'
track_points_app ────────────────► 'points:<id>'      (walk profile only)
observations (detail cols) ──────► 'obs:<id>'         (observation profile only)
photos + signed URLs ────────────► 'photos:…'         (1 h signed URLs, cached)
route_revisions ─────────────────► 'revisions:<id>'
colonies_app, colony_visits ─────► 'colonies', 'colony:<id>'
```

- Tables are fetched once per visit and filtered in the browser; the filter row never refetches. Writes call `invalidate(prefix)` then `reload()`.
- `getWalks` selects `*` so columns added by later migrations (e.g. `route_version`) appear without a code change.
- `getRoutes` reads `routes_admin` (rules, archived routes) and falls back to the older `routes` + `routes_app` pair when the migration is not applied yet. `createRoute`/`updateRoute` send rule columns only when the database has them (`routesHaveRules`).
- `getTrackPoints` returns `null` before the migration; the walk profile says the raw-fix charts need it.
- Preview mode (`VITE_PREVIEW=1 pnpm --filter @tunisia-survey/dashboard dev`) serves `preview.ts`: Tunis neighbourhoods, 190 sessions over 6 months, fixed routes walked forwards and (one in six) backwards, partial coverage, flagged sessions, raw fixes with rejected points, known animals with pending and rejected links, colonies with visit logs. `PREVIEW` is a literal `false` in production, so the module is never bundled.

---

## 6. Route protocols

### 6.1 Model

A route is an **ordered** LineString: the first vertex is the start, the last the end. A loop is a route whose ends are within 60 m.

| Rule             | Column                       | Values                                                 | Why                                                                                                    |
| ---------------- | ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Direction        | `direction_rule`             | `as_drawn` (one way, start → end), `either`            | Detection depends on which side and angle animals are seen from; one direction keeps visits comparable |
| Side             | `side_rule`                  | `both`, `left`, `right` (facing the walking direction) | Streets with one inaccessible side                                                                     |
| Strip width      | `strip_width_m`              | 1–500 m                                                | Truncation distance for distance sampling                                                              |
| Time window      | `window_start`, `window_end` | both or neither                                        | Activity varies through the day                                                                        |
| Target duration  | `target_duration_min`        | 5–600                                                  | Effort per visit                                                                                       |
| Revisit interval | `revisit_days`               | 0–365                                                  | Temporal independence of repeat surveys (occupancy, N-mixture)                                         |
| Completeness     | `require_complete`           | boolean                                                | Absences are only valid on complete checklists                                                         |
| Instructions     | `instructions`               | ≤ 2000 chars                                           | Exact start, hazards, local knowledge                                                                  |

### 6.2 Versioning

`routes.version` starts at 1. The `route_versioning` trigger compares the new row with the old one: a change in vertex order or position (`ST_OrderingEquals`, so a reversed line counts as a change) or in any rule writes the old line and rules to `route_revisions` and increments the version. Renaming alone and switching live/paused do not. Each session stores `route_version` at insert (`session_route_version` trigger), so analyses can split visits by protocol version.

### 6.3 Archive and delete

Archiving sets `deleted_at` (and `is_active = false`); the route leaves `routes_app` (the mobile app) and the portal's live and paused lists, and stays in `routes_admin` with its history. `routes_block_hard_delete` refuses `DELETE` for any route with sessions; the portal offers Delete Forever only for routes nobody walked.

### 6.4 Compliance checks (`lib/compliance.ts`)

Computed in the browser from the walk's track and the route line (local equirectangular projection, metre accuracy over a few km), so they work on any database version.

| Check                | Pass                                                                                                     | Warn                        | Fail                   |
| -------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- | ---------------------- |
| Started at the start | ≤ 60 m from the start (either end if `either`, not a loop)                                               | ≤ 150 m                     | farther                |
| Direction            | net progress along the line ≥ 15% of its length in the drawn direction (`as_drawn`), always for `either` | too little movement to tell | net progress backwards |
| Coverage             | ≥ 90% of 20 m samples of the line within strip + 15 m of the track                                       | ≥ 70%                       | less                   |
| Stayed on the route  | ≤ 10% of track samples farther than 2 × strip                                                            | ≤ 25%                       | more                   |
| Time window          | start time inside (windows may wrap midnight)                                                            |                             | outside                |
| Revisit interval     | gap to the previous unflagged visit by anyone ≥ `revisit_days`                                           | shorter                     |                        |
| Duration             | 0.6–1.8 × target                                                                                         | ≥ 0.4 ×                     | less                   |
| Complete checklist   | complete                                                                                                 |                             | not complete           |

Score = (passes + ½ warns) / applicable checks. Shown on walk profiles, the walk list, route profiles, route cards and person profiles. Direction is decided from progress between ~40 samples, ignoring jumps across a loop's seam.

### 6.5 Mobile app

`routes_app` now also returns the rules and version. `routeFromServer` maps them onto `FixedRoute.rules`, and the route picker shows a "Rules for this route" panel (direction, side, strip, time window, completeness, instructions) in Arabic, French and English. Older servers simply omit the panel.

---

## 7. Database changes (`supabase/migrations/20261003000100_route_protocols.sql`)

- `routes`: rule columns, `version`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`; check that a time window has both ends.
- `route_revisions` (researcher-read only, written by trigger).
- Triggers: `route_versioning` (before insert/update), `routes_block_hard_delete` (before delete), `session_route_version` (before insert on sessions). Backfill of `sessions.route_version`.
- Views: `routes_app` (new columns appended; archived routes hidden), `routes_admin` (all routes with rules, gated by `is_researcher()`), `track_points_app` (raw fixes as lat/lon, same RLS as `track_points`).
- Behaviour test: `supabase/tests/route_protocols.behaviour.sql` (version starts at 1, sessions record it, a reversed line bumps it and keeps the old one, a rename does not, walked routes refuse delete, archived routes leave the app view, researcher-only views, read-only history).

### Privacy and integrity (`20261004000100_privacy_and_integrity.sql`)

Who sees what, enforced by row-level security and tested in `supabase/tests/privacy_and_integrity.behaviour.sql`:

| Data                                                                                                                               | Owner              | Other volunteers                                                             | Researchers/admins          |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------- | --------------------------- |
| Profile totals (`people_stats`): cats and dogs counted, surveys, km, complete checklists, colonies and packs registered or visited | yes                | yes                                                                          | yes                         |
| Exact animal position, standing point, bearing                                                                                     | yes                | no: `observation_cards()` and `individuals_app` round to 3 decimals (~100 m) | yes                         |
| Walked tracks and raw GPS fixes                                                                                                    | yes                | no                                                                           | yes (outside privacy zones) |
| Consent columns                                                                                                                    | via `my_consent()` | no                                                                           | no                          |
| Emails (`user_directory()`)                                                                                                        | no                 | no                                                                           | yes                         |

Effort and counts are fixed once uploaded: `sessions_protect_effort` and `observations_protect_counts` keep distance, times, protocol, completeness, species and group size unchanged for direct client edits (the sync functions run as owner and are unaffected), so the leaderboard cannot be inflated after the server checks ran. Phone sessions live in the encrypted keychain (`apps/mobile/src/services/authStorage.ts`). `supabase/tests/security_invariants.test.ts` checks the migrations for these rules; `run_sql_behaviour.sh` replays every migration on a throwaway PostGIS container and runs all behaviour checks.

### People's names and emails (`20261003000200_display_names.sql`)

The app keeps each person's name in their auth profile (`full_name`, or the Google name) and never wrote it to `public.users.display_name`, so the portal showed everyone except the signed-in researcher as "Unnamed volunteer". The migration backfills `display_name` from the auth profile, else the part of the email before the @, and keeps it filled on sign-up and on profile changes (without overwriting a name already set). `user_directory()` returns email, last sign-in and sign-in method to researchers and admins only; the portal merges it into People and person profiles and falls back to display names alone when the function is missing. `personName()` in `data/api.ts` is the one naming rule, and `useCore()` fills `observer_name` on sightings with it.

Deploy with `bash supabase/scripts/deploy_migration.sh supabase/migrations/20261003000100_route_protocols.sql` after running the behaviour test on a copy.

---

## 8. Analysis rules every chart follows

1. Flagged sessions never count as effort (km, minutes, sessions, encounter rate, rankings). They are counted separately and shown with reasons.
2. Species filters apply to sightings only; walks stay in, because a walk with no cats is effort for cats.
3. Empty buckets are zeros for counts and `null` (a gap) for ratios and means; a complete zero-animal walk is a real zero in the encounter rate.
4. Encounter rate = animals on complete transects ÷ km of those transects. Labelled an index of effort, never a density.
5. Totals for ratios and means are recomputed from parts, not averaged from buckets.
6. Leaderboards and "most effort" rank by km or complete checklists only.
7. Deltas compare equal-length windows; "All time" shows no delta.

---

## 9. Design system

Design read: a research operations console for ecologists and admins, in the porcelain style of the reference boards (white pill controls on a cool grey shell, a near-black pill for the selected item) with Hawem's green accent. Density medium-high, motion low.

- **Tokens** come from `packages/design-tokens` (`hawemLight`/`hawemDark`) as CSS variables; the shell, pill, glass, shadow, grid, chart and heat variables are dashboard-only in `index.css`, each defined for light and dark.
- **Surfaces**: `shell` page background, `surface` cards (24 px radius, soft drop in light, hairline ring in dark), `canvas` insets, glass top bar and floating map panels (solid fallback under `prefers-reduced-transparency`).
- **Controls**: pills (`Button kind="pill"`), black pill for primary and selected (`kind="dark"`, `Tabs`), segmented controls, 44 px primary targets, visible focus rings, switches with `role="switch"`.
- **Type**: SF Pro / system stack; 34 px page titles, 20–22 px card titles, 13–15 px body; tabular figures only in columns and axes.
- **Icons**: lucide; no emoji anywhere.
- **Charts** (dataviz method): one y-axis; 2 px lines; columns ≤ 24 px with 4 px rounded data ends; 2 px surface gaps in stacks; 10% area washes; solid hairline grid; legend for ≥ 2 series; values in text colours, never series colours; crosshair tooltip listing every series, also on keyboard (arrow keys); table twin on every chart. Categorical palette: species pair (cat blue, dog orange) and an 8-slot breakdown palette, both validated with `validate_palette.js` against the light and dark surfaces (all checks pass). Colour follows the entity: routes and volunteers keep their slot via `slotOf()` over a stable ordering, never rank. Heat ramps are a single green hue light → dark.
- **Maps**: start = green dot with white ring, end = near-black dot, routes orange with white casing and white arrows, tracks green, bearing lines dashed, rejected fixes small red dots.
- **Accessibility**: skip link, landmarks, `aria-current` in navigation, labelled inputs, `aria-live` counts and notices, focus-trapped dialogs and drawers with Escape, confirmation for every destructive action, keyboard command palette.

---

## 10. Verification

- `pnpm --filter @tunisia-survey/dashboard test`: `test/lib.test.ts` (exports, CSV, geometry) and `test/analysis.test.ts` (filters keep walks under species filters, inclusive custom ranges, equal previous window, encounter-rate rules, empty buckets, species breakdown, trend and rolling mean, compliance forward/reverse/partial/either/revisit, loop rotation).
- `pnpm --filter @tunisia-survey/dashboard build` (TypeScript strict + Vite); the build must not contain preview data.
- `VITE_PREVIEW=1` dev server and a browser pass over every page in light, dark and at 390 px width.
- `psql -f supabase/tests/route_protocols.behaviour.sql` on a database copy before deploying the migration.

---

## 11. Known limits and next steps

- The portal UI is English; the mobile app is trilingual. Translating the portal (and mirroring it for Arabic) would reuse the app's locale files.
- Compliance is computed client-side over loaded tracks (up to 2,000). A server view would be needed past that scale.
- Follow Streets depends on the Mapbox Directions API with the public token.
- The animal "surveyed but not seen" capture-history state uses sightings within 300 m as a proxy for effort near the animal; an exact version would intersect tracks with the animal's range.
