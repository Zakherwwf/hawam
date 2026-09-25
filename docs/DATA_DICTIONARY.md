# Scientific Data Dictionary: Hawem (v2)

This document specifies the scientific schema, field definitions, allowed values, validation constraints, and statistical model usage for the data collected by the Hawem platform.

---

## 1. Profiles & Observers (`profiles`)
Records user profiles, roles, and research participation.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, maps to Supabase `auth.users.id` | Observer ID for modeling observer detection heterogeneity ($p_i$). |
| `display_name` | `TEXT` | Non-empty string | Attribution in research reports. |
| `avatar` | `TEXT` | URI or storage path | User identity. |
| `preferred_language` | `TEXT` | `'ar'`, `'fr'`, `'en'` (default: `'ar'`) | Localization setting. |
| `role` | `TEXT` | `'volunteer'`, `'trained_surveyor'`, `'researcher'`, `'admin'` | Covariate for observer skill and detection probability. |
| `team_id` | `UUID` | Nullable, references `teams(id)` | Group aggregation. |
| `xp_total` | `INTEGER` | `>= 0` | Engagement metric. |
| `level` | `INTEGER` | `1 – 30` | Skill/experience tier. |
| `leaderboard_visibility` | `TEXT` | `'public'`, `'anonymous'`, `'hidden'` | Privacy compliance. |
| `consent_version` | `TEXT` | e.g. `'v1.0'` | Ethical audit compliance. |
| `created_at` | `TIMESTAMPTZ` | ISO 8601 | Registration date. |

---

## 2. Privacy Zones (`privacy_zones`)
Protects observers' home locations from being exposed in public tracks (similar to Strava privacy zones).

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Zone identifier. |
| `user_id` | `UUID` | References `profiles(id)` | Zone ownership. |
| `center` | `GEOGRAPHY(Point, 4326)`| Observer home coordinate | Masking boundary center. |
| `radius_m` | `INTEGER` | `100 – 1000` meters | Exclusion buffer radius. |

---

## 3. Fixed Survey Routes (`routes`)
Predefined transect routes established for longitudinal repeat-visit surveys.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Fixed transect identifier. |
| `name_ar`, `name_fr`, `name_en` | `TEXT` | Localized route names | Standardized naming. |
| `geometry` | `GEOGRAPHY(LineString, 4326)` | Valid LineString | **Occupancy & Distance Sampling**: Fixed survey transect definition for multi-season repeat models. |
| `length_km` | `NUMERIC(6, 3)` | Transect length in km | Effort metric ($L$). |
| `governorate_code` | `TEXT` | ISO 3166-2:TN (e.g. `'TN-11'`) | Regional stratum. |
| `delegation_code` | `TEXT` | Tunisian delegation code | Sub-regional administrative covariate. |
| `difficulty` | `TEXT` | `'easy'`, `'moderate'`, `'challenging'` | Terrain classification. |
| `created_by` | `UUID` | References `profiles(id)` | Provenance. |
| `is_official` | `BOOLEAN` | `TRUE` or `FALSE` | Official research route status. |

---

## 4. Survey Sessions (`sessions`)
Tracks observer effort and metadata across structured surveys and incidental encounters.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUIDv7` | Primary Key, client-generated | Sampling event identifier (`eventID` in Darwin Core). |
| `user_id` | `UUID` | References `profiles(id)` | Observer identity for detection modeling. |
| `protocol` | `TEXT` | `'transect'`, `'stationary_point'`, `'incidental'` | Distinguishes structured surveys from presence-only opportunism. |
| `route_id` | `UUID` | Nullable, references `routes(id)` | Links repeat visits to fixed transects. |
| `started_at` | `TIMESTAMPTZ` | ISO 8601 | Start time for calculating survey effort and temporal covariates. |
| `ended_at` | `TIMESTAMPTZ` | ISO 8601 | End time of the survey. |
| `moving_time_s` | `INTEGER` | `>= 0` | Active walking duration in seconds. |
| `duration_s` | `INTEGER` | `>= 0` | Total session duration in seconds. |
| `distance_m` | `NUMERIC(8, 2)` | `>= 0` | Total transect length ($L$) for Distance Sampling density calculations ($D = \frac{n}{2 w L \hat{P}}$). |
| `track` | `GEOGRAPHY(LineString, 4326)` | Simplified GPS path | **Distance Sampling & SECR**: Actual search path traversed. |
| `complete_session` | `BOOLEAN` | `TRUE` or `FALSE` | **eBird Complete Checklist Protocol**: Declares if every individual seen was recorded. Allows **non-detections** ($0$ count) to be formally used in occupancy and N-mixture models. |
| `n_observers` | `INTEGER` | `>= 1` | Covariate for detection probability ($p$). |
| `weather` | `TEXT` | `'clear'`, `'cloudy'`, `'rain'`, `'wind'`, `'hot'` | Detection probability covariate. |
| `time_of_day` | `TEXT` | `'dawn'`, `'morning'`, `'afternoon'`, `'dusk'`, `'night'` | Circadian activity covariate. |
| `avg_gps_accuracy_m` | `NUMERIC(6, 2)` | Meters | Spatial quality filter. |
| `mock_location_detected` | `BOOLEAN` | `TRUE` or `FALSE` | Anti-cheat and spatial integrity flag. |
| `h3_cells_res9` | `TEXT[]` | H3 index strings | Area coverage evaluation. |
| `validation_status` | `TEXT` | `'pending'`, `'valid'`, `'flagged'` | Scientific quality gate. |

---

## 5. Observations (`observations`)
The scientific record for an animal or group encounter.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUIDv7` | Primary Key, client-generated | Occurrence identifier (`occurrenceID` in Darwin Core). |
| `session_id` | `UUID` | References `sessions(id)` | Links occurrence to sampling event. |
| `user_id` | `UUID` | References `profiles(id)` | Data provenance. |
| `observed_at` | `TIMESTAMPTZ` | ISO 8601 | Precise sighting timestamp. |
| `observer_location` | `GEOGRAPHY(Point, 4326)` | Exact observer GPS position | Observer position at time of detection. |
| `animal_location` | `GEOGRAPHY(Point, 4326)` | Computed via bearing & distance | **SECR / Spatial Point Process**: True estimated position of the animal. |
| `location_method` | `TEXT` | `'compass'`, `'map_tap'`, `'same_as_observer'` | Georeferencing provenance. |
| `bearing_deg` | `NUMERIC(5, 2)` | `0 – 360` degrees | Compass bearing from observer to animal. |
| `distance_estimate_m` | `NUMERIC(6, 2)` | Radial distance in meters | Radial distance to animal. |
| `perpendicular_distance_m` | `NUMERIC(6, 2)` | Perpendicular distance from track | **Distance Sampling**: Primary metric for fitting detection function $g(x)$. |
| `gps_accuracy_m` | `NUMERIC(6, 2)` | Accuracy radius in meters | Spatial error propagation. |
| `h3_res9` | `TEXT` | H3 resolution 9 cell (~0.1 km²) | High-resolution spatial indexing. |
| `h3_res7` | `TEXT` | H3 resolution 7 cell (~5 km²) | Regional aggregate indexing. |
| `governorate_code` | `TEXT` | ISO 3166-2:TN | Regional administrative stratum. |
| `delegation_code` | `TEXT` | Delegation code | Sub-regional administrative covariate. |
| `species` | `TEXT` | `'cat'`, `'dog'`, `'unknown'` | Target taxon classification. |
| `group_size` | `INTEGER` | `>= 1` | Cluster size; essential for cluster-adjusted distance sampling ($E[S]$). |
| `individual_id` | `UUID` | Nullable, references `individuals(id)` | **SECR / Mark-Resight**: Links occurrence to a confirmed individual identity. |
| `is_welfare_alert` | `BOOLEAN` | `TRUE` or `FALSE` | High-priority veterinary/NGO triage flag. |
| `colony_id` | `UUID` | Nullable, references `colonies(id)` | Association with a permanent colony or feeding point. |
| `notes` | `TEXT` | Qualitative field notes | Contextual observations. |

---

## 6. Animal Attributes (`observation_animals`)
Specific demographic and health metrics recorded per animal when `group_size >= 1`.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `observation_id` | `UUID` | References `observations(id)` | Parent observation. |
| `sex` | `TEXT` | `'male'`, `'female'`, `'unknown'` | Demographic sex ratio analysis. |
| `age_class` | `TEXT` | `'juvenile'`, `'adult'`, `'unknown'` | Recruitment and age structure estimation. |
| `reproductive_status` | `TEXT` | `'lactating'`, `'visibly_pregnant'`, `'none_visible'`, `'unknown'` | **ICAM Indicator**: Population turnover and reproduction rate. |
| `body_condition_score`| `INTEGER` | `1` (Emaciated), `2` (Thin), `3` (Ideal), `4` (Overweight), `5` (Obese) | **ICAM Welfare Metric**: 5-point validated visual body condition score. |
| `health_issues` | `TEXT[]` | Multi-select: `skin_lesions_mange`, `wound`, `limping`, `eye_nose_discharge`, `tumour`, `emaciation`, `none` | Disease prevalence and rabies risk indicators. |
| `ear_tip_or_notch` | `TEXT` | `'yes'`, `'no'`, `'unknown'` | **TNR Marker**: Proportion of sterilized/vaccinated animals. |
| `collar_or_tag` | `TEXT` | `'yes'`, `'no'`, `'unknown'` | Owned vs unowned / roaming status indicator. |
| `behaviour` | `TEXT` | `'approachable'`, `'neutral'`, `'fearful'`, `'aggressive'` | Human-animal interaction dynamics & rabies risk profiling. |
| `being_fed_by_people` | `TEXT` | `'yes'`, `'no'`, `'unknown'` | Food provisioning covariate. |
| `coat_pattern` | `TEXT` | `'tabby'`, `'bicolour_piebald'`, `'tortoiseshell_calico'`, `'solid_black'`, `'solid_other'`, `'merle_brindle'`, `'other'` | Re-identification feature. |
| `habitat_type` | `TEXT` | `'residential'`, `'commercial'`, `'market'`, `'landfill_garbage'`, `'slaughterhouse_vicinity'`, `'agricultural'`, `'beach_coastal'`, `'natural_area'`, `'other'` | Resource Selection Function (RSF) covariate. |
| `food_sources_visible` | `TEXT[]` | Multi-select: `garbage`, `deliberate_feeding`, `none`, `other` | Resource availability covariate. |

---

## 7. Photos (`photos`)
Standardized multi-angle photographs for individual re-identification.

| Field | Type | Allowed Values / Constraints | Statistical Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key | Photo record ID. |
| `observation_id` | `UUID` | References `observations(id)` | Parent observation. |
| `storage_path` | `TEXT` | Supabase storage bucket path | Cloud image asset. |
| `thumbnail_path` | `TEXT` | Local/cloud thumbnail path | Fast UI rendering. |
| `angle` | `TEXT` | `'left_flank'`, `'right_flank'`, `'face'`, `'other'` | **Mark-Resight**: Asymmetric coat pattern capture angles. |
| `blur_score` | `NUMERIC(4, 2)` | Automated sharpness evaluation | Image quality filtering. |
| `brightness_score` | `NUMERIC(4, 2)` | Automated exposure evaluation | Lighting quality filtering. |
| `upload_status` | `TEXT` | `'pending'`, `'uploading'`, `'synced'`, `'failed'` | Resumable TUS sync state. |

---

## 8. Known Individuals & Matches (`individuals` & `individual_matches`)
Supports capture-recapture by maintaining individual identity registries.

| Table | Field | Type | Purpose |
| :--- | :--- | :--- | :--- |
| `individuals` | `id` | `UUID` | Unique animal identity across space and time. |
| `individuals` | `species` | `'cat'`, `'dog'` | Taxon. |
| `individuals` | `nickname` | `TEXT` | Surveyor-assigned nickname. |
| `individuals` | `identifiability`| `'high'`, `'low'` | Solid coat colors marked low identifiability. |
| `individuals` | `sightings_count`| `INTEGER` | Total capture history count ($n_i$). |
| `individual_matches` | `candidate_individual_id` | `UUID` | Candidate individual linked. |
| `individual_matches` | `decision` | `'same'`, `'different'`, `'unsure'` | Human or algorithm match decision. |
| `individual_matches` | `status` | `'proposed'`, `'confirmed'`, `'rejected'` | Consensus gate (≥ 2 independent agreements). |
