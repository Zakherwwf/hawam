# Project Brief: Hawem (حايم) — Fauna Observatory

## 1. High-Level Concept
**Hawem** (*حايم* — roving / free-roaming in Tunisian Arabic) is an open-source, full-stack citizen-science platform and ecological observatory for monitoring, re-identifying, and protecting free-roaming dog and cat populations across Greater Tunis (Médina, Bab Souika, Carthage, La Marsa, Lac 2).

## 2. Primary Input
- **Spatial Field Telemetry**: Observer GPS tracks, transect routes, compass bearings, and perpendicular distances to animals.
- **Multimodal Photographic Evidence**: Multi-angle photos (Left Flank, Right Flank, Face) of free-roaming animals.
- **Ecological Indicators**: ICAM (International Companion Animal Management) Body Condition Scores (1–5), group sizes, behavior, and sterilization ear-notches (TNR).
- **Colony Inspections**: Managed cat colonies, feeding stations, water/shelter provision, and caretaker logs.

## 3. Critical Value Transformation
1. **Multimodal Intelligence Tier**: Gemini 3 / Gemini 3.1 Pro Vision analysis to automatically classify species, coat pattern, TNR ear-tip status, and estimate ICAM body condition scores from field photos.
2. **PostGIS Spatial Rigor**: Automatic computation of perpendicular distance to transect line via `ST_Distance` and aggregation into the official Tunisian 1 km² spatial grid.
3. **Offline-First Resilience**: Transactional outbox queuing in SQLite/AsyncStorage with automatic dependency-ordered sync to PostgreSQL.
4. **Research Data Interoperability**: Real-time generation and native sharing of Darwin Core Archive (DwC-A) occurrence packages and SECR (Spatially Explicit Capture-Recapture) detection matrices for R statistical analysis.

## 4. Explicit Negative Constraints (Out of Scope for this cycle)
- **NO new screens or tabs**: The 5-tab Cupertino navigation architecture (`[Map]`, `[Survey]`, `[Animals]`, `[Progress]`, `[Profile]`) is fixed.
- **NO third-party proprietary trackers or analytics**: Zero user surveillance. Observer privacy buffers (300m home exclusion zones) and 1 km² grid blurring remain strictly enforced.
- **NO emojis**: All mobile and web interface glyphs must remain pure SVG (`IOSIcon` / Lucide).
- **NO cloud hard-dependencies for core field logging**: The app must remain 100% operational offline with deterministic fallback heuristics when the Gemini API or network gateway is unreachable.
