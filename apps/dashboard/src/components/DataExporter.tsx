import React, { useState, useEffect } from 'react';
import {
  exportToDarwinCore,
  exportCaptureHistoryMatrix,
  exportDistanceSampling,
  objectsToCSV,
  SurveySession,
  ObservationPublic,
  Individual,
  ObservationRestrictedLocation,
} from '@tunisia-survey/shared';
import { getLiveSessions, getLiveObservations } from '../services/supabase';

// Simulated dataset for demonstration of export routines
const MOCK_SESSIONS: SurveySession[] = [
  {
    id: 'sess-medina-01',
    observer_id: 'usr-vol-01',
    protocol: 'transect',
    start_time: '2026-09-20T07:30:00Z',
    end_time: '2026-09-20T08:30:00Z',
    duration_min: 60,
    distance_km: 1.8,
    complete_session: true,
    number_of_observers: 1,
    app_version: '1.0.0',
    track: {
      type: 'LineString',
      coordinates: [[10.165, 36.802], [10.170, 36.805]],
    },
  },
  {
    id: 'sess-medina-02-empty',
    observer_id: 'usr-vol-01',
    protocol: 'transect',
    start_time: '2026-09-21T07:30:00Z',
    end_time: '2026-09-21T08:30:00Z',
    duration_min: 60,
    distance_km: 1.8,
    complete_session: true, // Complete survey with ZERO animals seen (Non-detection)
    number_of_observers: 1,
    app_version: '1.0.0',
    track: {
      type: 'LineString',
      coordinates: [[10.165, 36.802], [10.170, 36.805]],
    },
  },
  {
    id: 'sess-ariana-03',
    observer_id: 'usr-surv-02',
    protocol: 'transect',
    start_time: '2026-09-22T08:00:00Z',
    end_time: '2026-09-22T09:15:00Z',
    duration_min: 75,
    distance_km: 2.2,
    complete_session: true,
    number_of_observers: 2,
    app_version: '1.0.0',
    track: {
      type: 'LineString',
      coordinates: [[10.192, 36.862], [10.198, 36.869]],
    },
  },
];

const MOCK_OBSERVATIONS: ObservationPublic[] = [
  {
    id: 'obs-001',
    session_id: 'sess-medina-01',
    observer_id: 'usr-vol-01',
    observed_at: '2026-09-20T07:45:00Z',
    location_public: { type: 'Point', coordinates: [10.168, 36.804] },
    grid_cell_id: 'TUN-32N-1KM-594-4074',
    species: 'cat',
    group_size: 1,
    distance_from_path_m: 6.2,
    sex: 'female',
    age_class: 'adult',
    reproductive_status: 'lactating',
    body_condition_score: 3,
    visible_health_issues: ['none'],
    ear_tip_or_notch: 'yes',
    collar_or_tag: 'no',
    behaviour: 'neutral',
    being_fed_by_people: 'yes',
    habitat_type: 'market',
    food_sources_visible: ['deliberate_feeding'],
    linked_individual_id: 'ind-cat-01',
  },
  {
    id: 'obs-002',
    session_id: 'sess-ariana-03',
    observer_id: 'usr-surv-02',
    observed_at: '2026-09-22T08:35:00Z',
    location_public: { type: 'Point', coordinates: [10.195, 36.865] },
    grid_cell_id: 'TUN-32N-1KM-597-4081',
    species: 'dog',
    group_size: 2,
    distance_from_path_m: 14.0,
    sex: 'male',
    age_class: 'adult',
    reproductive_status: 'none_visible',
    body_condition_score: 2,
    visible_health_issues: ['skin_lesions_mange'],
    ear_tip_or_notch: 'no',
    collar_or_tag: 'no',
    behaviour: 'fearful',
    being_fed_by_people: 'no',
    habitat_type: 'residential',
    food_sources_visible: ['garbage'],
    linked_individual_id: 'ind-dog-02',
  },
];

const MOCK_RESTRICTED_LOCATIONS = new Map<string, ObservationRestrictedLocation>([
  [
    'obs-001',
    {
      observation_id: 'obs-001',
      location_precise: { type: 'Point', coordinates: [10.1678123, 36.8039871] },
      gps_accuracy_m: 3.5,
    },
  ],
  [
    'obs-002',
    {
      observation_id: 'obs-002',
      location_precise: { type: 'Point', coordinates: [10.1948921, 36.8649012] },
      gps_accuracy_m: 4.8,
    },
  ],
]);

const MOCK_INDIVIDUALS: Individual[] = [
  {
    id: 'ind-cat-01',
    species: 'cat',
    coat_description: 'Tabby avec plastron blanc',
    first_seen: '2026-09-20',
    last_seen: '2026-09-20',
    confirmed_by: 'researcher-01',
  },
  {
    id: 'ind-dog-02',
    species: 'dog',
    coat_description: 'Chien jaune créole, oreille droite cassée',
    first_seen: '2026-09-22',
    last_seen: '2026-09-22',
    confirmed_by: 'researcher-01',
  },
];

export const DataExporter: React.FC = () => {
  const [includePreciseCoords, setIncludePreciseCoords] = useState(false);
  const [auditReason, setAuditReason] = useState('');
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SurveySession[]>(MOCK_SESSIONS);
  const [observations, setObservations] = useState<ObservationPublic[]>(MOCK_OBSERVATIONS);
  const [liveDbCount, setLiveDbCount] = useState<number>(0);

  useEffect(() => {
    async function loadLiveDbData() {
      try {
        const liveSess = await getLiveSessions();
        const liveObs = await getLiveObservations();

        if (liveSess.length > 0 || liveObs.length > 0) {
          setLiveDbCount(liveSess.length);

          const mappedSessions: SurveySession[] = liveSess.map((s: any) => ({
            id: s.id,
            observer_id: s.observer_id || 'usr-vol',
            protocol: s.protocol,
            start_time: s.start_time,
            end_time: s.end_time,
            duration_min: s.duration_min || 30,
            distance_km: s.distance_km || 1.5,
            complete_session: s.complete_session,
            number_of_observers: s.number_of_observers || 1,
            app_version: s.app_version || '2.0.0',
            track: s.session_tracks?.[0]?.track || null,
          }));

          const mappedObservations: ObservationPublic[] = liveObs.map((o: any) => ({
            id: o.id,
            session_id: o.session_id,
            observer_id: 'usr-vol',
            observed_at: o.observed_at,
            location_public: o.location_public || { type: 'Point', coordinates: [10.18, 36.8] },
            grid_cell_id: o.grid_cell_id || 'TN32N-1KM',
            species: o.species,
            group_size: o.group_size || 1,
            distance_from_path_m: o.distance_from_path_m || 5.0,
            sex: o.sex || 'unknown',
            age_class: o.age_class || 'unknown',
            reproductive_status: o.reproductive_status || 'unknown',
            body_condition_score: o.body_condition_score || 3,
            visible_health_issues: o.visible_health_issues || [],
            ear_tip_or_notch: o.ear_tip_or_notch || 'unknown',
            collar_or_tag: o.collar_or_tag || 'unknown',
            behaviour: o.behaviour || 'neutral',
            being_fed_by_people: o.being_fed_by_people || 'unknown',
            habitat_type: o.habitat_type || 'residential',
            food_sources_visible: o.food_sources_visible || [],
            coat_pattern: o.coat_pattern || 'tabby',
            notes: o.notes || '',
          }));

          setSessions([...mappedSessions, ...MOCK_SESSIONS]);
          setObservations([...mappedObservations, ...MOCK_OBSERVATIONS]);
        }
      } catch (err) {
        console.warn('Could not load live data:', err);
      }
    }
    loadLiveDbData();
  }, []);

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDarwinCore = () => {
    if (includePreciseCoords && !auditReason) {
      alert("L'export des coordonnées précises requiert un motif de recherche légitime pour le registre d'audit.");
      return;
    }

    const dwc = exportToDarwinCore(sessions, observations, {
      allowPreciseCoordinates: includePreciseCoords,
      restrictedLocations: includePreciseCoords ? MOCK_RESTRICTED_LOCATIONS : undefined,
    });

    const csv = objectsToCSV(dwc);
    const filename = `darwin_core_tunisia_${includePreciseCoords ? 'RESEARCHER_EXACT' : 'PUBLIC_1KM'}_${Date.now()}.csv`;
    downloadFile(csv, filename);

    setDownloadNotice(
      `Export Darwin Core téléchargé (${dwc.length} enregistrements). ${
        includePreciseCoords
          ? "⚠️ Accès aux coordonnées précises consigné dans 'export_audit_log'."
          : "Coordonnées publiques généralisées à 1 km."
      }`
    );
  };

  const handleExportSECR = () => {
    const secr = exportCaptureHistoryMatrix(MOCK_INDIVIDUALS, sessions, observations);
    const flat = secr.map((row) => ({
      individual_id: row.individual_id,
      species: row.species,
      coat_description: row.coat_description,
      ...row.occasions.reduce((acc: Record<string, number>, occ: string, i: number) => {
        acc[`occasion_${i + 1}_${occ}`] = row.history[i];
        return acc;
      }, {} as Record<string, number>),
    }));

    const csv = objectsToCSV(flat);
    downloadFile(csv, `capture_history_secr_unmarked_${Date.now()}.csv`);
    setDownloadNotice(`Matrice d'historique de capture (SECR / MARK) téléchargée.`);
  };

  const handleExportDistance = () => {
    const dist = exportDistanceSampling(sessions, observations, 'Grand Tunis');
    const csv = objectsToCSV(dist);
    downloadFile(csv, `distance_sampling_r_package_${Date.now()}.csv`);
    setDownloadNotice(`Fichier d'échantillonnage par distance (R package Distance) téléchargé.`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Module d'Exportation Scientifique</h2>
        <p className="text-sm text-slate-500">
          Génération de jeux de données calibrés pour les progiciels de modélisation statistique en écologie quantitative.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            PostgreSQL PostGIS Live ({sessions.length} sessions, {observations.length} observations)
          </span>
          {liveDbCount > 0 && (
            <span className="text-xs text-emerald-700 font-medium">
              ({liveDbCount} session(s) synchronisée(s) en direct depuis les téléphones mobiles)
            </span>
          )}
        </div>
      </div>

      {downloadNotice && (
        <div className="bg-teal-50 border border-teal-200 text-teal-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>✓ {downloadNotice}</span>
          <button onClick={() => setDownloadNotice(null)} className="text-teal-600 font-bold ml-4">✕</button>
        </div>
      )}

      {/* Sensitive Location Toggle Card */}
      <div className={`p-6 rounded-2xl border transition ${
        includePreciseCoords
          ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/20'
          : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🛡️</span>
              <h3 className="text-base font-bold text-slate-800">
                Mode d'exportation des coordonnées spatiales
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-xl">
              Par défaut, tous les exports appliquent la généralisation éthique à 1 km² pour protéger les animaux contre les risques d'abattage municipal.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includePreciseCoords}
              onChange={(e) => setIncludePreciseCoords(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
          </label>
        </div>

        {includePreciseCoords && (
          <div className="mt-4 pt-4 border-t border-amber-200/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wide">
              <span>⚠️ Habilitation Chercheur / Audit Obligatoire</span>
            </div>
            <input
              type="text"
              required
              placeholder="Indiquez le motif d'utilisation (ex: Modélisation SECR Institut Pasteur Tunis / Projet Rage)"
              value={auditReason}
              onChange={(e) => setAuditReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[11px] text-amber-700">
              Chaque téléchargement comportant les coordonnées GPS réelles génère un enregistrement inviolable dans la table <code>export_audit_log</code>.
            </p>
          </div>
        )}
      </div>

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Darwin Core */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🌍</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">DwC-A / CSV</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">Darwin Core Occurrence</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Standard mondial de biodiversité (GBIF). Inclut présences, absences complètes (non-détections), effort d'échantillonnage, sexe et statut reproducteur.
            </p>
          </div>

          <button
            onClick={handleExportDarwinCore}
            className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            Télécharger Darwin Core
          </button>
        </div>

        {/* 2. Capture-History Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl">🧬</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">secr / MARK</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">Capture-Recapture (SECR)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Matrice binaire d'historique de détection (0/1) par occasion d'échantillonnage pour chaque individu identifié par photo-ID.
            </p>
          </div>

          <button
            onClick={handleExportSECR}
            className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            Télécharger Matrice SECR
          </button>
        </div>

        {/* 3. Distance Sampling */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl">📐</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">R Distance</span>
            </div>
            <h3 className="text-base font-bold text-slate-800">Distance Sampling (Transects)</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tableau des longueurs d'effort de transect couplées aux distances perpendiculaires des animaux observés pour estimer la détectabilité g(x).
            </p>
          </div>

          <button
            onClick={handleExportDistance}
            className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            Télécharger Échantillonnage Distance
          </button>
        </div>
      </div>
    </div>
  );
};
