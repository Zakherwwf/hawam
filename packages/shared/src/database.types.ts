export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar: string | null;
          preferred_language: 'ar' | 'fr' | 'en';
          role: 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin';
          team_id: string | null;
          xp_total: number;
          level: number;
          leaderboard_visibility: 'public' | 'anonymous' | 'hidden';
          consent_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          avatar?: string | null;
          preferred_language?: 'ar' | 'fr' | 'en';
          role?: 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin';
          team_id?: string | null;
          xp_total?: number;
          level?: number;
          leaderboard_visibility?: 'public' | 'anonymous' | 'hidden';
          consent_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar?: string | null;
          preferred_language?: 'ar' | 'fr' | 'en';
          role?: 'volunteer' | 'trained_surveyor' | 'researcher' | 'admin';
          team_id?: string | null;
          xp_total?: number;
          level?: number;
          leaderboard_visibility?: 'public' | 'anonymous' | 'hidden';
          consent_version?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      privacy_zones: {
        Row: {
          id: string;
          user_id: string;
          center: unknown;
          radius_m: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          center: unknown;
          radius_m?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          center?: unknown;
          radius_m?: number;
          created_at?: string;
        };
      };
      routes: {
        Row: {
          id: string;
          name_ar: string;
          name_fr: string;
          name_en: string;
          name: string;
          geometry: unknown;
          length_km: number;
          governorate_code: string;
          delegation_code: string;
          difficulty: 'easy' | 'moderate' | 'challenging';
          created_by: string | null;
          is_official: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name_ar?: string;
          name_fr?: string;
          name_en?: string;
          geometry: unknown;
          length_km?: number;
          governorate_code?: string;
          delegation_code?: string;
          difficulty?: 'easy' | 'moderate' | 'challenging';
          created_by?: string | null;
          is_official?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name_ar?: string;
          name_fr?: string;
          name_en?: string;
          geometry?: unknown;
          length_km?: number;
          governorate_code?: string;
          delegation_code?: string;
          difficulty?: 'easy' | 'moderate' | 'challenging';
          created_by?: string | null;
          is_official?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
      };
      colonies: {
        Row: {
          id: string;
          type: 'cat_colony' | 'feeding_point' | 'dog_pack_area';
          location: unknown;
          name: string;
          created_by: string | null;
          notes: string | null;
          last_verified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'cat_colony' | 'feeding_point' | 'dog_pack_area';
          location: unknown;
          name: string;
          created_by?: string | null;
          notes?: string | null;
          last_verified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'cat_colony' | 'feeding_point' | 'dog_pack_area';
          location?: unknown;
          name?: string;
          created_by?: string | null;
          notes?: string | null;
          last_verified_at?: string | null;
          created_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          observer_id: string | null;
          protocol: 'transect' | 'stationary_point' | 'incidental';
          route_id: string | null;
          started_at: string;
          start_time: string;
          ended_at: string | null;
          end_time: string | null;
          moving_time_s: number;
          duration_s: number;
          duration_min: number | null;
          distance_m: number;
          distance_km: number | null;
          complete_session: boolean;
          n_observers: number;
          number_of_observers: number;
          track: unknown | null;
          weather: string | null;
          time_of_day: string | null;
          avg_gps_accuracy_m: number | null;
          device_gps_accuracy_avg: number | null;
          mock_location_detected: boolean;
          app_version: string | null;
          device_model: string | null;
          h3_cells_res9: string[] | null;
          validation_status: 'pending' | 'valid' | 'flagged';
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          observer_id?: string | null;
          protocol: 'transect' | 'stationary_point' | 'incidental';
          route_id?: string | null;
          started_at?: string;
          start_time?: string;
          ended_at?: string | null;
          end_time?: string | null;
          moving_time_s?: number;
          duration_s?: number;
          duration_min?: number | null;
          distance_m?: number;
          distance_km?: number | null;
          complete_session?: boolean;
          n_observers?: number;
          number_of_observers?: number;
          track?: unknown | null;
          weather?: string | null;
          time_of_day?: string | null;
          avg_gps_accuracy_m?: number | null;
          device_gps_accuracy_avg?: number | null;
          mock_location_detected?: boolean;
          app_version?: string | null;
          device_model?: string | null;
          h3_cells_res9?: string[] | null;
          validation_status?: 'pending' | 'valid' | 'flagged';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          observer_id?: string | null;
          protocol?: 'transect' | 'stationary_point' | 'incidental';
          route_id?: string | null;
          started_at?: string;
          start_time?: string;
          ended_at?: string | null;
          end_time?: string | null;
          moving_time_s?: number;
          duration_s?: number;
          duration_min?: number | null;
          distance_m?: number;
          distance_km?: number | null;
          complete_session?: boolean;
          n_observers?: number;
          number_of_observers?: number;
          track?: unknown | null;
          weather?: string | null;
          time_of_day?: string | null;
          avg_gps_accuracy_m?: number | null;
          device_gps_accuracy_avg?: number | null;
          mock_location_detected?: boolean;
          app_version?: string | null;
          device_model?: string | null;
          h3_cells_res9?: string[] | null;
          validation_status?: 'pending' | 'valid' | 'flagged';
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      track_points: {
        Row: {
          id: string;
          session_id: string;
          recorded_at: string;
          location: unknown;
          accuracy_m: number;
          altitude: number | null;
          speed: number | null;
          heading: number | null;
          provider: string | null;
          is_mock: boolean;
          rejected_reason: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          recorded_at?: string;
          location: unknown;
          accuracy_m?: number;
          altitude?: number | null;
          speed?: number | null;
          heading?: number | null;
          provider?: string | null;
          is_mock?: boolean;
          rejected_reason?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          recorded_at?: string;
          location?: unknown;
          accuracy_m?: number;
          altitude?: number | null;
          speed?: number | null;
          heading?: number | null;
          provider?: string | null;
          is_mock?: boolean;
          rejected_reason?: string | null;
        };
      };
      observations: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          observer_id: string | null;
          observed_at: string;
          location_public: unknown;
          grid_cell_id: string;
          h3_res9: string | null;
          h3_res7: string | null;
          species: 'cat' | 'dog' | 'unknown';
          group_size: number;
          distance_from_path_m: number | null;
          distance_estimate_m: number | null;
          bearing_deg: number | null;
          gps_accuracy_m: number | null;
          individual_id: string | null;
          is_welfare_alert: boolean;
          colony_id: string | null;
          body_condition_score: number | null;
          habitat_type: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          observer_id?: string | null;
          observed_at?: string;
          location_public: unknown;
          grid_cell_id: string;
          h3_res9?: string | null;
          h3_res7?: string | null;
          species: 'cat' | 'dog' | 'unknown';
          group_size?: number;
          distance_from_path_m?: number | null;
          distance_estimate_m?: number | null;
          bearing_deg?: number | null;
          gps_accuracy_m?: number | null;
          individual_id?: string | null;
          is_welfare_alert?: boolean;
          colony_id?: string | null;
          body_condition_score?: number | null;
          habitat_type?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          observer_id?: string | null;
          observed_at?: string;
          location_public?: unknown;
          grid_cell_id?: string;
          h3_res9?: string | null;
          h3_res7?: string | null;
          species?: 'cat' | 'dog' | 'unknown';
          group_size?: number;
          distance_from_path_m?: number | null;
          distance_estimate_m?: number | null;
          bearing_deg?: number | null;
          gps_accuracy_m?: number | null;
          individual_id?: string | null;
          is_welfare_alert?: boolean;
          colony_id?: string | null;
          body_condition_score?: number | null;
          habitat_type?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      observation_locations_restricted: {
        Row: {
          observation_id: string;
          location_precise: unknown;
          observer_location: unknown | null;
          location_method: 'compass' | 'map_tap' | 'same_as_observer';
          gps_accuracy_m: number | null;
          created_at: string;
        };
        Insert: {
          observation_id: string;
          location_precise: unknown;
          observer_location?: unknown | null;
          location_method?: 'compass' | 'map_tap' | 'same_as_observer';
          gps_accuracy_m?: number | null;
          created_at?: string;
        };
        Update: {
          observation_id?: string;
          location_precise?: unknown;
          observer_location?: unknown | null;
          location_method?: 'compass' | 'map_tap' | 'same_as_observer';
          gps_accuracy_m?: number | null;
          created_at?: string;
        };
      };
      observation_animals: {
        Row: {
          id: string;
          observation_id: string;
          sex: 'male' | 'female' | 'unknown';
          age_class: 'juvenile' | 'adult' | 'unknown';
          reproductive_status: 'lactating' | 'visibly_pregnant' | 'none_visible' | 'unknown';
          body_condition_score: number | null;
          health_issues: string[];
          ear_tip_or_notch: 'yes' | 'no' | 'unknown';
          collar_or_tag: 'yes' | 'no' | 'unknown';
          behaviour: 'approachable' | 'neutral' | 'fearful' | 'aggressive';
          being_fed_by_people: 'yes' | 'no' | 'unknown';
          coat_pattern: string | null;
          primary_colour: string | null;
          habitat_type: string | null;
          food_sources_visible: string[];
        };
        Insert: {
          id?: string;
          observation_id: string;
          sex?: 'male' | 'female' | 'unknown';
          age_class?: 'juvenile' | 'adult' | 'unknown';
          reproductive_status?: 'lactating' | 'visibly_pregnant' | 'none_visible' | 'unknown';
          body_condition_score?: number | null;
          health_issues?: string[];
          ear_tip_or_notch?: 'yes' | 'no' | 'unknown';
          collar_or_tag?: 'yes' | 'no' | 'unknown';
          behaviour?: 'approachable' | 'neutral' | 'fearful' | 'aggressive';
          being_fed_by_people?: 'yes' | 'no' | 'unknown';
          coat_pattern?: string | null;
          primary_colour?: string | null;
          habitat_type?: string | null;
          food_sources_visible?: string[];
        };
        Update: {
          id?: string;
          observation_id?: string;
          sex?: 'male' | 'female' | 'unknown';
          age_class?: 'juvenile' | 'adult' | 'unknown';
          reproductive_status?: 'lactating' | 'visibly_pregnant' | 'none_visible' | 'unknown';
          body_condition_score?: number | null;
          health_issues?: string[];
          ear_tip_or_notch?: 'yes' | 'no' | 'unknown';
          collar_or_tag?: 'yes' | 'no' | 'unknown';
          behaviour?: 'approachable' | 'neutral' | 'fearful' | 'aggressive';
          being_fed_by_people?: 'yes' | 'no' | 'unknown';
          coat_pattern?: string | null;
          primary_colour?: string | null;
          habitat_type?: string | null;
          food_sources_visible?: string[];
        };
      };
      photos: {
        Row: {
          id: string;
          observation_id: string;
          storage_path: string;
          thumbnail_path: string | null;
          angle: 'left_flank' | 'right_flank' | 'face' | 'other';
          taken_at: string;
          upload_status: 'pending' | 'uploading' | 'synced' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          observation_id: string;
          storage_path: string;
          thumbnail_path?: string | null;
          angle?: 'left_flank' | 'right_flank' | 'face' | 'other';
          taken_at?: string;
          upload_status?: 'pending' | 'uploading' | 'synced' | 'failed';
          created_at?: string;
        };
        Update: {
          id?: string;
          observation_id?: string;
          storage_path?: string;
          thumbnail_path?: string | null;
          angle?: 'left_flank' | 'right_flank' | 'face' | 'other';
          taken_at?: string;
          upload_status?: 'pending' | 'uploading' | 'synced' | 'failed';
          created_at?: string;
        };
      };
      xp_events: {
        Row: {
          id: string;
          user_id: string;
          source_type: string;
          source_id: string | null;
          xp: number;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_type: string;
          source_id?: string | null;
          xp: number;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source_type?: string;
          source_id?: string | null;
          xp?: number;
          reason?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      submit_survey_bundle: {
        Args: {
          payload: Json;
        };
        Returns: Json;
      };
      get_public_density_map: {
        Args: {
          min_count_threshold?: number;
          filter_species?: string;
          start_date?: string;
          end_date?: string;
        };
        Returns: {
          grid_cell_id: string;
          centroid_lon: number;
          centroid_lat: number;
          observation_count: number;
          total_individuals: number;
          dominant_species: string;
        }[];
      };
      nearby_individuals: {
        Args: {
          p_species: string;
          p_lat: number;
          p_lon: number;
          p_radius_m?: number;
        };
        Returns: {
          id: string;
          species: string;
          nickname: string | null;
          coat_pattern: string;
          sightings_count: number;
          distance_m: number;
          photo_thumbnail_path: string | null;
        }[];
      };
    };
  };
}
