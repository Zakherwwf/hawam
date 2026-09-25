# Product Specification: Hawem (حايم) Citizen-Science Observatory

## 1. Executive Vision
Hawem empowers Tunisian researchers (Institut Pasteur de Tunis, DGSV, municipal veterinarians, animal welfare NGOs) and trained citizen-science volunteers to conduct standardized, non-invasive ecological monitoring of free-roaming dogs and cats. The platform bridges rigorous distance-sampling methodologies with multimodal AI assistance and participatory community stewardship.

---

## 2. Target Personas

### Persona A: Academic Field Biologist / Veterinarian
- **Needs**: High-precision transect recording, exact perpendicular distance measurement to animals, SECR capture-history matrices for density estimation, ICAM welfare classification, and exportable Darwin Core packages for GBIF.
- **Pain Point**: Manual data transcription from paper sheets in the field, difficulty standardizing body condition scores across multiple field assistants.

### Persona B: Community Colony Caretaker / Volunteer
- **Needs**: Easy-to-use mobile logging for daily colony inspections, tracking neutered/vaccinated (TNR) rates, checking feeding stations, and receiving gamified XP rewards and streak badges.
- **Pain Point**: Complex scientific software with steep learning curves, lack of mobile data in urban medinas and outer districts.

### Persona C: Municipal Health & Rabies Officer
- **Needs**: Real-time aggregated density heatmaps across 1 km² national grid cells, identification of unvaccinated/unsterilized clusters, and rapid reporting of injured or aggressive animals without revealing sensitive colony feeder locations.

---

## 3. Functional Requirements & Acceptance Boundaries

### F1: Multimodal AI Classification (Gemini 3 / Gemini 3.1 Pro)
- **Input**: Animal photograph captured in-app (left flank, right flank, or face).
- **Processing**: Structured multimodal visual analysis with strict JSON schema output.
- **Output**:
  - `species`: `'cat' | 'dog' | 'unknown'` (confidence $\ge 0.70$)
  - `breedOrType`: string descriptor (e.g., "North African local cat / Mau mix", "Local baladi dog")
  - `coatPattern`: string descriptor (e.g., "Tabby mackerel with white chest", "Fawn short-coat")
  - `estimatedBodyConditionScore`: integer (1 to 5, ICAM criteria) with rationale.
  - `tnrStatus`: `'left_ear_tipped' | 'right_ear_tipped' | 'untipped' | 'uncertain'`
  - `apparentWelfareAlert`: boolean indicating severe emaciation (BCS 1), open wounds, or lameness.
- **Acceptance Boundary**: Analysis must complete in $\le 2.5$s on broadband; when offline or if the API key is unset, the system falls back gracefully to a deterministic local heuristic without user disruption or runtime errors.

### F2: Structured Transect Survey & Corridor Guidance
- **Corridor Monitoring**: Official Greater Tunis transects (Bab Souika, Habib Bourguiba, Carthage Byrsa, La Marsa, Lac 2).
- **Deviation Alerts**: Live warning banner displayed if surveyor moves $> 50$ meters outside the transect corridor.
- **Guardian Bonus**: Repeating an official transect 5 times unlocks the `route_guardian` badge and awards $+15$ XP.
- **Workout Summary**: Apple Fitness-style concentric rings for Effort Duration, Distance Covered, and eBird Protocol Completeness.

### F3: Managed Colony & Feeding Station Registry
- **Layer Control**: Dedicated toggle for violet colony pins on interactive Mapbox views.
- **Colony Dossier**: Live sterilization rate ($TNR\% = \frac{\text{Sterilized}}{\text{Total}} \times 100$), feeding schedule, water/shelter provision, and inspection logging ($+10$ XP).

### F4: Data Sovereignty & Offline-First Outbox
- **Queueing**: All surveys and opportunistic logs stored in local transactional outbox before cloud push.
- **Conflict Resolution**: Observer ID and timestamp hashing guarantees idempotent inserts via `submit_survey_bundle` RPC.
- **Export Formats**: Standardized Darwin Core Archive (`occurrence.csv`) and SECR spatial matrices available directly from mobile settings and web dashboard.

---

## 4. Operational & Negative Constraints
1. **Zero Layout Regressions**: Existing 5-tab architecture (`[Map]`, `[Survey]`, `[Animals]`, `[Progress]`, `[Profile]`) remains untouched.
2. **Pure SVG Aesthetics**: No unicode emojis in production interfaces; all icons rendered via Apple HIG `IOSIcon`.
3. **Privacy Zone Preservation**: All public exports mask coordinates within a 300m exclusion buffer around observer home zones and aggregate to 1 km² national grid cells.
