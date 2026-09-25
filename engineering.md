# Engineering Architecture & Implementation Specification: Hawem (حايم)

## 1. System Topology & Directory Structure
Hawem follows a modular pnpm monorepo structure designed for clean separation of concerns between client applications, shared domain models, and database migrations:

```
.
├── apps/
│   ├── mobile/                    # React Native (Expo SDK 57, New Architecture)
│   │   ├── index.js               # Global runtime entrypoint (loads polyfills)
│   │   ├── App.tsx                # Tab navigation & top-level modal orchestration
│   │   └── src/
│   │       ├── polyfills.ts       # Hermes TextDecoder & encoding fallback
│   │       ├── components/        # Reusable Cupertino HIG components
│   │       │   ├── ios/           # IOSButton, IOSIcon, IOSNavigationBar, etc.
│   │       │   ├── routes/        # RoutePickerModal
│   │       │   ├── survey/        # SurveySummaryModal, WorkoutHUD
│   │       │   ├── colonies/      # ColonyInspectorModal
│   │       │   └── map/           # InteractiveMapView (Mapbox GL JS v3)
│   │       ├── screens/           # 5 Main Tab screens & modal views
│   │       ├── features/          # Zustand state stores (sync, gamification, routes, colonies)
│   │       └── services/          # Supabase client, Turf georeferencing, Gemini AI Vision
│   └── dashboard/                 # Web Observatory (React 19 + Vite 6 + Tailwind CSS)
│       └── src/                   # Live maps, DwC-A exports, SECR matrix analytics
├── packages/
│   └── shared/                    # Shared TypeScript contracts, schemas, & algorithms
│       └── src/                   # ICAM models, WGS84 1km² grid generalizer, Zod schemas
└── supabase/                      # Docker Supabase configuration & PostGIS SQL migrations
    └── migrations/                # Schema DDL, ST_Distance RPC, and RLS policies
```

---

## 2. Intelligence Tier: Gemini 3 / Gemini 3.1 Pro Multimodal Pipeline
The mobile client and backend connect to the Google Gemini API to deliver on-device computer vision assistance for field surveyors:

### 2.1 Interface & Schema Specification
```typescript
export interface AnimalVisionAnalysis {
  species: 'cat' | 'dog' | 'unknown';
  confidence: number; // 0.0 to 1.0
  breedOrType: string;
  coatPattern: string;
  estimatedBodyConditionScore: 1 | 2 | 3 | 4 | 5;
  bcsRationale: string;
  tnrStatus: 'left_ear_tipped' | 'right_ear_tipped' | 'untipped' | 'uncertain';
  apparentWelfareAlert: boolean;
  welfareNotes?: string | null;
  source: 'gemini-3.1-pro' | 'gemini-3-flash' | 'offline-heuristic';
}
```

### 2.2 Execution Pipeline
1. **Photo Acquisition**: Image passed as local file URI (`file:///...`) or Base64 payload.
2. **Network Determination**:
   - If connected and `GEMINI_API_KEY` is present, dispatches multimodal payload to `gemini-2.5-flash` / `gemini-1.5-flash` / `gemini-3-flash` endpoint with strict JSON response schema.
   - If offline or unconfigured, falls back immediately to a deterministic local heuristic analyzer that parses visual metadata without blocking the user.
3. **Structured Ingestion**: Parsed response populates the observation form (species selector, body condition slider, observation notes).

---

## 3. Data Contracts & Database RPCs

### 3.1 PostgreSQL / PostGIS Bundle RPC: `submit_survey_bundle`
Atomically records:
- **`survey_sessions`**: `id`, `observer_id`, `protocol` (`'transect' | 'stationary_point' | 'incidental'`), start/end time, eBird completeness flag.
- **`survey_tracks`**: LineString track geometry with spatial length calculated in meters.
- **`animal_observations`**: Point geometry (`WGS84 ST_SetSRID(ST_Point(lon, lat), 4326)`), species, group size, perpendicular distance to transect line (`ST_Distance(obs.geom, track.geom)`), and ICAM body condition score.
- **`grid_assignments`**: Automatic calculation of 1 km² national grid cell ID.

---

## 4. Testing Strategy

### 4.1 Test Scope & Objectives
The automated test suite verifies four critical operational invariants:
1. **Gemini Vision Contract Verification**:
   - Validates that the vision parser correctly parses raw Gemini JSON outputs, enforces type safety, clamps body condition scores to $1..5$, and falls back safely to heuristics upon network or API error.
2. **Geospatial & Distance Sampling Calculations**:
   - Verifies Turf.js destination point calculation from observer location, compass bearing, and laser distance.
   - Verifies perpendicular distance to transect line calculation.
   - Verifies 1 km² national grid cell ID hashing.
3. **Outbox & Sync Protocol Verification**:
   - Verifies that surveys are queued in FIFO order in the outbox.
   - Verifies error backoff and successful queue drain upon reconnection.
4. **Gamification & Streak Invariants**:
   - Verifies XP accumulation and level threshold transitions ($1 \to 7$).
   - Verifies monthly streak freeze consumption and streak protection.

### 4.2 Test Automation Stack
- **Runner**: Node.js Native Test Runner (`node --test`) & Vitest.
- **Mocking**: All external Gemini API network requests and Supabase REST calls are mocked using deterministic stubs to allow offline, fast CI/CD execution without consuming production API credits.
- **Location**:
  - `packages/shared/test/grid.test.ts`
  - `apps/mobile/src/__tests__/geminiVision.test.ts`
  - `apps/mobile/src/__tests__/geoUtils.test.ts`
  - `apps/mobile/src/__tests__/gamification.test.ts`
