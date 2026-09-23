# Scientific Data Dictionary: Citizen Science Platform for Free-Roaming Cats & Dogs (Tunisia)

This document specifies the scientific schema, field definitions, allowed values, validation constraints, and statistical model usage for the data collected by this platform.

---

## 1. Users (`users`)
Records user profiles, assigned roles, preferences, and ethical consent acceptance.

| Field | Type | Allowed Values / Constraints | Statistical / Operational Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, maps to `auth.users.id` | Observer identification; needed to model observer covariates / detection heterogeneity. |
| `role` | `TEXT` | `'volunteer'`, `'trained_surveyor'`, `'researcher'`, `'admin'` | Role-Based Access Control (RBAC). Restricts access to precise coordinates. |
| `preferred_language`| `TEXT` | `'ar'`, `'fr'`, `'en'` | UI localization preference (default `'ar'`). |
| `consent_version_accepted` | `TEXT` | e.g. `'v1.0'` | Privacy & ethical compliance; verification of consent to anonymized location sharing. |
| `created_at` | `TIMESTAMPTZ` | ISO 8601 | User account lifecycle tracking. |

---

## 2. Fixed Routes (`routes`)
Predefined transect routes established by researchers for repeat-visit surveys.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Unique route identifier. |
| `name` | `TEXT` | Descriptive name (e.g. `"Tunis Medina Transect A"`) | Route naming and surveyor reference. |
| `geometry` | `GEOMETRY(LineString, 4326)` | Valid GeoJSON / PostGIS LineString | **Occupancy & Distance Sampling**: Fixed survey transect definition for repeat-visit models. |
| `governorate` | `TEXT` | Tunisian Governorates (e.g. `"Tunis"`, `"Ariana"`, `"Sfax"`) | Administrative stratifier for regional density estimation. |
| `delegation` | `TEXT` | Tunisian Delegations / Mutamadiyat | Sub-regional administrative covariate. |
| `habitat_notes` | `TEXT` | Detailed description of urban/suburban layout | Environmental covariate for occupancy and detection probability. |
| `created_by` | `UUID` | References `users(id)` (Researcher role) | Audit trail of route creation. |

---

## 3. Survey Sessions (`sessions`)
Tracks observer effort and metadata across structured surveys and incidental encounters.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Sampling event identifier (`eventID` in Darwin Core). |
| `observer_id` | `UUID` | References `users(id)` | Observer identity for modeling observer-specific detection bias. |
| `protocol` | `TEXT` | `'transect'`, `'stationary_point'`, `'incidental'` | Distinguishes structured surveys from presence-only opportunism. |
| `route_id` | `UUID` | Nullable, references `routes(id)` | Links repeat visits to fixed transects (critical for multi-season occupancy). |
| `start_time` | `TIMESTAMPTZ`| ISO 8601 | Start time for calculating survey effort and temporal covariates. |
| `end_time` | `TIMESTAMPTZ`| ISO 8601 | End time of the survey. |
| `duration_min` | `NUMERIC(6, 2)` | `>= 0` | **Survey Effort**: Standard measure of time effort in N-mixture models. |
| `track` | `GEOMETRY(LineString, 4326)` | Battery-aware sampled GPS path | **Distance Sampling & SECR**: Actual search path traversed; gives total line length ($L$). |
| `distance_km` | `NUMERIC(6, 3)` | `>= 0` | Total transect length ($L$) for Distance Sampling density calculations ($D = \frac{n}{2 w L \hat{P}}$). |
| `complete_session`| `BOOLEAN` | `TRUE` or `FALSE` | **eBird Complete Checklist Protocol**: Declares if every individual seen was recorded. Allows **non-detections** ($0$ count) to be formally used in occupancy and N-mixture models. |
| `number_of_observers`| `INTEGER` | `>= 1` | Covariate for detection probability ($p$). |
| `weather` | `TEXT` | `'clear'`, `'cloudy'`, `'rain'`, `'wind'` | Detection probability covariate. |
| `time_of_day` | `TEXT` | `'dawn'`, `'morning'`, `'afternoon'`, `'dusk'`, `'night'` | Activity pattern and circadian covariate. |
| `app_version` | `TEXT` | Semantic version string | Quality assurance and feature flag tracking. |
| `device_gps_accuracy_avg` | `NUMERIC(6, 2)` | Meters | Spatial quality filter. |

---

## 4. Observations (`observations`)
The scientific record for an animal or group encounter. **Contains generalized location.**

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Occurrence identifier (`occurrenceID` in Darwin Core). |
| `session_id` | `UUID` | References `sessions(id)` | Links occurrence to sampling event. |
| `observer_id` | `UUID` | References `users(id)` | Data provenance. |
| `observed_at` | `TIMESTAMPTZ`| ISO 8601 | Precise timestamp of sighting. |
| `location_public` | `GEOMETRY(Point, 4326)` | Centroid of ~1 km grid cell | **Ethical public exposure**: Prevents animal culling while allowing macro-spatial analysis. |
| `grid_cell_id` | `TEXT` | e.g. UTM / MGRS 1km identifier | Grid indexing for spatial aggregation. |
| `species` | `TEXT` | `'cat'`, `'dog'`, `'unknown'` | Target taxon classification. |
| `group_size` | `INTEGER` | `>= 1` | Cluster size; essential for cluster-adjusted distance sampling ($E[S]$). |
| `distance_from_path_m` | `NUMERIC(6, 2)` | Perpendicular distance in meters (nullable) | **Distance Sampling**: Primary variable for fitting the detection function $g(x)$. |
| `sex` | `TEXT` | `'male'`, `'female'`, `'unknown'` | Demographic sex ratio analysis. |
| `age_class` | `TEXT` | `'juvenile'`, `'adult'`, `'unknown'` | Demographic age distribution; recruitment estimation. |
| `reproductive_status`| `TEXT` | `'lactating'`, `'visibly_pregnant'`, `'none_visible'`, `'unknown'` | **ICAM Indicator**: Population turnover and reproductive activity rate. |
| `body_condition_score`| `INTEGER` | `1` (Emaciated), `2` (Thin), `3` (Ideal), `4` (Overweight), `5` (Obese) | **ICAM Welfare Metric**: 5-point validated visual body condition score. |
| `visible_health_issues`| `TEXT[]` | Multi-select: `skin_lesions_mange`, `wound`, `limp`, `eye_nose_discharge`, `tumour`, `none` | Population health & disease prevalence indicators (e.g. mange, rabies surveillance). |
| `ear_tip_or_notch` | `TEXT` | `'yes'`, `'no'`, `'unknown'` | **TNR Marker**: Proportion of sterilized animals (vaccination & sterilization coverage). |
| `collar_or_tag` | `TEXT` | `'yes'`, `'no'`, `'unknown'` | Owned vs unowned / roaming status indicator. |
| `behaviour` | `TEXT` | `'approachable'`, `'neutral'`, `'fearful'`, `'aggressive'` | Human-animal interaction dynamics & rabies risk profiling. |
| `being_fed_by_people`| `TEXT` | `'yes'`, `'no'`, `'unknown'` | Food provisioning covariate. |
| `habitat_type` | `TEXT` | `'residential'`, `'commercial'`, `'market'`, `'landfill_garbage_site'`, `'slaughterhouse_vicinity'`, `'agricultural'`, `'beach_coastal'`, `'natural_area'`, `'other'` | Habitat selection and resource-selection function (RSF) covariate. |
| `food_sources_visible` | `TEXT[]` | `garbage`, `deliberate_feeding`, `none`, `other` | Resource availability covariate. |
| `notes` | `TEXT` | Free text | Qualitative observations. |
| `linked_individual_id` | `UUID` | Nullable, references `individuals(id)` | **SECR / Mark-Resight**: Links occurrence to a confirmed individual identity. |

---

## 5. Restricted Locations (`observation_locations_restricted`)
⚠️ **STRICTLY CONFIDENTIAL**: Accessible exclusively by `researcher` and `admin` roles via RLS.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `observation_id` | `UUID` | Primary Key, references `observations(id)` | 1-to-1 linkage to public observation record. |
| `location_precise` | `GEOMETRY(Point, 4326)` | Exact GPS coordinates | **SECR (Spatially Explicit Capture-Recapture)**: Used in scientific packages (`secr`) to model animal activity centers and home ranges. NEVER EXPOSED PUBLICLY. |
| `gps_accuracy_m` | `NUMERIC(6, 2)` | GPS HDOP accuracy radius in meters | Spatial error modeling and filtering. |
| `created_at` | `TIMESTAMPTZ`| ISO 8601 | Insertion timestamp. |

---

## 6. Photos (`photos`)
Photographs captured for individual re-identification and coat pattern analysis.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Unique photo identifier. |
| `observation_id` | `UUID` | References `observations(id)` | Links photo to observation. |
| `storage_path` | `TEXT` | Path in private Supabase Storage bucket | Object store URI. All personal EXIF data is stripped prior to upload. |
| `angle` | `TEXT` | `'left_flank'`, `'right_flank'`, `'face'`, `'other'` | Multi-angle capture requirement: coat markings are asymmetric, so left and right flanks must be matched separately. |
| `coat_pattern` | `TEXT` | `'tabby'`, `'bicolour_piebald'`, `'tortoiseshell_calico'`, `'solid_black'`, `'solid_other'`, `'other'` | Re-identifiability covariate (solid coat patterns have lower re-identification certainty). |
| `taken_at` | `TIMESTAMPTZ`| Timestamp | Verification of sighting time. |

---

## 7. Individuals (`individuals`)
Catalogue of confirmed individual animals identified through photographic mark-resight.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Individual animal ID for capture histories ($h_{ij}$). |
| `species` | `TEXT` | `'cat'`, `'dog'` | Taxon. |
| `coat_description` | `TEXT` | Distinguishing marks, coat color, scars | Biological descriptive record. |
| `first_seen` | `TIMESTAMPTZ`| Date/time of first capture occasion | Apparent survival and population turnover models (Cormack-Jolly-Seber). |
| `last_seen` | `TIMESTAMPTZ`| Date/time of most recent capture occasion | Survival and encounter frequency modeling. |
| `confirmed_by` | `UUID` | References `users(id)` (Researcher) | Scientific verification attribution. |

---

## 8. Individual Matches (`individual_matches`)
Review queue for matching photo pairs to confirm or reject individual identities.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Match candidate record. |
| `photo_a` | `UUID` | References `photos(id)` | First photo. |
| `photo_b` | `UUID` | References `photos(id)` | Second photo. |
| `method` | `TEXT` | `'human'`, `'algorithm'` | Flags human visual match vs automated algorithm. |
| `score` | `NUMERIC(4, 3)` | Range `0.000` to `1.000` | Confidence metric from matching algorithm (or 1.0 for human). |
| `status` | `TEXT` | `'proposed'`, `'confirmed'`, `'rejected'` | Review status managed by researcher dashboard. |
| `reviewer_id` | `UUID` | References `users(id)` | Researcher performing validation. |

---

## 9. Export Audit Log (`export_audit_log`)
Monitors all downloads containing precise coordinates.

| Field | Type | Allowed Values / Constraints | Operational Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Audit entry ID. |
| `user_id` | `UUID` | References `users(id)` | Identity of researcher requesting export. |
| `export_type` | `TEXT` | `'darwin_core'`, `'secr'`, `'distance'`, `'raw_sql'` | Type of data exported. |
| `row_count` | `INTEGER` | `>= 0` | Volume of data exported. |
| `precise_location_included` | `BOOLEAN` | `TRUE` or `FALSE` | High-security flag. |
| `query_params` | `JSONB` | Filter params (governorate, date range) | Scientific and ethical accountability record. |
| `created_at` | `TIMESTAMPTZ`| ISO 8601 | Exact export timestamp. |
