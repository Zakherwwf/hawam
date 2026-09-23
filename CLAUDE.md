# Project Guidelines: Citizen-Science App for Free-Roaming Cats & Dogs (Tunisia)

## Scientific Mission
This platform collects high-quality, analysis-ready citizen science data on free-roaming cats and dogs in Tunisia for researchers (academic institutions, Institut Pasteur de Tunis, veterinary services).
**The app does not estimate population size itself.** All collected data must feed directly into established statistical models:
- **Photographic Mark-Resight / Capture-Recapture**: Multi-angle re-identification (left flank, right flank, face).
- **Distance Sampling**: Transect routes + perpendicular animal distance from observer route.
- **Occupancy & N-Mixture Models**: Effort metadata (duration, route, speed) and explicit non-detections via complete checklist protocol ("Did you record every cat and dog you saw?"). Zero-detection sessions are scientifically essential.
- **Spatially Explicit Capture-Recapture (SECR)**: Individual ID + precise spatial coordinates.

---

## ⚠️ NON-NEGOTIABLE ETHICAL CONSTRAINT: Location Protection
Free-roaming animals in Tunisia are vulnerable to municipal culling and poisoning. **Precise geographic coordinates must NEVER be publicly exposed or accessible to standard app users.**

1. **Database-Level Isolation**:
   - Precise coordinates (`location_precise`) are stored exclusively in the restricted table `observation_locations_restricted`.
   - Access is locked via PostgreSQL Row-Level Security (RLS) to `researcher` and `admin` roles only.
   - Standard volunteers, surveyors, and anonymous clients must NEVER be granted SELECT rights on `location_precise`.
2. **Public Generalization**:
   - Public-facing records and maps generalize coordinates to a ~1 km grid cell (`location_public` and `grid_cell_id`).
   - Public maps show aggregated density per grid cell with a minimum threshold (k-anonymity) to avoid pinpointing isolated animals.
   - All public exports include Darwin Core `dataGeneralizations` and `informationWithheld` declarations.
3. **Audit Trail**:
   - Any export or access of precise coordinates by researchers must be recorded in `export_audit_log`.
4. **Mandatory Automated Tests**:
   - Every build must run tests verifying that non-researcher tokens cannot query `location_precise` through any API or view.
5. **No Third-Party Location Leakage**:
   - Do not integrate any third-party SDK or paid service that collects, transmits, or exposes un-generalized location data without explicit consent.

---

## Tech Stack & Conventions
- **Monorepo**:
  - `apps/mobile`: React Native with Expo (TypeScript), Android-first, iOS compatible.
  - `apps/dashboard`: Researcher web dashboard (Vite + React + Tailwind).
  - `packages/shared`: Shared TypeScript types, schemas (Zod), and Darwin Core / SECR / Distance export mappers.
  - `supabase/`: Migrations, PostGIS functions, RLS policies, seed data, and security tests.
- **Offline-First**:
  - Local SQLite on mobile (`expo-sqlite`). Durable sync queue with retry/backoff.
- **Internationalization (i18n)**:
  - Default language: Arabic (`ar-TN`, RTL layout).
  - Supported languages: French (`fr`), English (`en`).
  - All UI strings externalized; RTL layout mirroring strictly maintained.
- **Documentation**:
  - Maintain `docs/DATA_DICTIONARY.md` for all field definitions, enumerations, and statistical method mappings.
