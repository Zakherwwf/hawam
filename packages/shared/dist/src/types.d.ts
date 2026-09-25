/**
 * Core domain types and enumerations for the Tunisia Free-Roaming Cat & Dog Survey.
 */
export type UserRole = 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin';
export type PreferredLanguage = 'ar' | 'fr' | 'en';
export type Species = 'cat' | 'dog' | 'unknown';
export type SurveyProtocol = 'transect' | 'stationary_point' | 'incidental';
export type Sex = 'male' | 'female' | 'unknown';
export type AgeClass = 'juvenile' | 'adult' | 'unknown';
export type ReproductiveStatus = 'lactating' | 'visibly_pregnant' | 'none_visible' | 'unknown';
/**
 * Validated ICAM 5-Point Body Condition Score (BCS):
 * 1 = Very Thin / Emaciated
 * 2 = Thin
 * 3 = Ideal
 * 4 = Overweight
 * 5 = Obese
 */
export type BodyConditionScore = 1 | 2 | 3 | 4 | 5;
export type HealthIssue = 'skin_lesions_mange' | 'wound' | 'limp' | 'eye_nose_discharge' | 'tumour' | 'none';
export type YesNoUnknown = 'yes' | 'no' | 'unknown';
export type AnimalBehaviour = 'approachable' | 'neutral' | 'fearful' | 'aggressive';
export type HabitatType = 'residential' | 'commercial' | 'market' | 'landfill_garbage_site' | 'slaughterhouse_vicinity' | 'agricultural' | 'beach_coastal' | 'natural_area' | 'other';
export type FoodSource = 'garbage' | 'deliberate_feeding' | 'none' | 'other';
export type PhotoAngle = 'left_flank' | 'right_flank' | 'face' | 'other';
export type CoatPattern = 'tabby' | 'bicolour_piebald' | 'tortoiseshell_calico' | 'solid_black' | 'solid_other' | 'other';
export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'wind';
export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'dusk' | 'night';
export type MatchStatus = 'proposed' | 'confirmed' | 'rejected';
export type MatchMethod = 'human' | 'algorithm';
export interface UserProfile {
    id: string;
    role: UserRole;
    preferred_language: PreferredLanguage;
    consent_version_accepted: string;
    created_at: string;
}
export interface Route {
    id: string;
    name: string;
    geometry: {
        type: 'LineString';
        coordinates: [number, number][];
    };
    governorate: string;
    delegation: string;
    habitat_notes?: string;
    created_by: string;
}
export interface SurveySession {
    id: string;
    observer_id: string;
    protocol: SurveyProtocol;
    route_id?: string | null;
    start_time: string;
    end_time?: string | null;
    duration_min?: number | null;
    track?: {
        type: 'LineString';
        coordinates: [number, number, number?, number?][];
    } | null;
    distance_km?: number | null;
    complete_session: boolean;
    number_of_observers: number;
    weather?: WeatherCondition | null;
    time_of_day?: TimeOfDay | null;
    app_version: string;
    device_gps_accuracy_avg?: number | null;
    created_at?: string;
}
export interface ObservationPublic {
    id: string;
    session_id: string;
    observer_id: string;
    observed_at: string;
    location_public: {
        type: 'Point';
        coordinates: [number, number];
    };
    grid_cell_id: string;
    species: Species;
    group_size: number;
    distance_from_path_m?: number | null;
    sex: Sex;
    age_class: AgeClass;
    reproductive_status: ReproductiveStatus;
    body_condition_score: BodyConditionScore;
    visible_health_issues: HealthIssue[];
    ear_tip_or_notch: YesNoUnknown;
    collar_or_tag: YesNoUnknown;
    behaviour: AnimalBehaviour;
    being_fed_by_people: YesNoUnknown;
    habitat_type: HabitatType;
    food_sources_visible: FoodSource[];
    notes?: string | null;
    linked_individual_id?: string | null;
    created_at?: string;
}
export interface ObservationRestrictedLocation {
    observation_id: string;
    location_precise: {
        type: 'Point';
        coordinates: [number, number];
    };
    gps_accuracy_m: number;
    created_at?: string;
}
export interface PhotoRecord {
    id: string;
    observation_id: string;
    storage_path: string;
    angle: PhotoAngle;
    coat_pattern?: CoatPattern | null;
    taken_at: string;
}
export interface Individual {
    id: string;
    species: Species;
    coat_description: string;
    first_seen: string;
    last_seen: string;
    confirmed_by: string;
}
export interface IndividualMatch {
    id: string;
    photo_a: string;
    photo_b: string;
    method: MatchMethod;
    score: number;
    status: MatchStatus;
    reviewer_id?: string | null;
}
export interface ExportAuditLog {
    id: string;
    user_id: string;
    export_type: 'darwin_core' | 'secr' | 'distance' | 'raw_sql';
    row_count: number;
    precise_location_included: boolean;
    query_params?: Record<string, unknown> | null;
    created_at: string;
}
