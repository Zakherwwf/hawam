/**
 * Scientific Data Exporters:
 * 1. Darwin Core Occurrence (DwC-A / CSV)
 * 2. Capture-History Matrix (SECR / MARK / unmarked)
 * 3. Distance Sampling (R Distance package)
 */
/**
 * Maps public observations and non-detection sessions to Darwin Core standard records.
 */
export function exportToDarwinCore(sessions, observations, options = {}) {
    const records = [];
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));
    // 1. Detections (Presence records)
    for (const obs of observations) {
        const session = sessionMap.get(obs.session_id);
        const effortDesc = session
            ? `duration_min=${session.duration_min ?? 0};distance_km=${session.distance_km ?? 0};protocol=${session.protocol}`
            : 'opportunistic';
        let lat = obs.location_public.coordinates[1];
        let lon = obs.location_public.coordinates[0];
        let uncertainty = 707;
        let generalizations = 'Coordinates generalized to 1 km grid centroid to protect free-roaming animals from municipal culling';
        let withheld = 'Exact GPS coordinates restricted to certified researchers and administrators';
        // If researcher export with explicit authorization:
        if (options.allowPreciseCoordinates && options.restrictedLocations) {
            const precise = options.restrictedLocations.get(obs.id);
            if (precise) {
                lon = precise.location_precise.coordinates[0];
                lat = precise.location_precise.coordinates[1];
                uncertainty = precise.gps_accuracy_m;
                generalizations = 'None (Certified Researcher Export)';
                withheld = 'None';
            }
        }
        const scientificName = obs.species === 'cat'
            ? 'Felis catus'
            : obs.species === 'dog'
                ? 'Canis lupus familiaris'
                : 'Carnivora';
        records.push({
            occurrenceID: obs.id,
            eventID: obs.session_id,
            eventDate: obs.observed_at,
            countryCode: 'TN',
            scientificName,
            vernacularName: obs.species,
            individualCount: obs.group_size,
            occurrenceStatus: 'present',
            samplingProtocol: session?.protocol ?? 'incidental',
            samplingEffort: effortDesc,
            decimalLatitude: lat,
            decimalLongitude: lon,
            coordinateUncertaintyInMeters: uncertainty,
            dataGeneralizations: generalizations,
            informationWithheld: withheld,
            sex: obs.sex,
            lifeStage: obs.age_class,
            reproductiveCondition: obs.reproductive_status,
            occurrenceRemarks: obs.notes ?? undefined,
        });
    }
    // 2. Non-Detections (Complete sessions where 0 animals were recorded)
    // eBird model: A complete session with zero detections is a valid absence record.
    const observedSessionIds = new Set(observations.map((o) => o.session_id));
    for (const session of sessions) {
        if (session.complete_session && !observedSessionIds.has(session.id)) {
            // Create non-detection absence records for target species (cat and dog)
            for (const sp of ['cat', 'dog']) {
                const sciName = sp === 'cat' ? 'Felis catus' : 'Canis lupus familiaris';
                // Use track centroid or start point if available
                const coords = session.track?.coordinates?.[0] ?? [10.1815, 36.8065]; // Fallback center of Tunis
                records.push({
                    occurrenceID: `absence-${session.id}-${sp}`,
                    eventID: session.id,
                    eventDate: session.start_time,
                    countryCode: 'TN',
                    scientificName: sciName,
                    vernacularName: sp,
                    individualCount: 0,
                    occurrenceStatus: 'absent',
                    samplingProtocol: session.protocol,
                    samplingEffort: `duration_min=${session.duration_min ?? 0};distance_km=${session.distance_km ?? 0};protocol=${session.protocol}`,
                    decimalLatitude: coords[1],
                    decimalLongitude: coords[0],
                    coordinateUncertaintyInMeters: 1000,
                    dataGeneralizations: 'Absence record inferred from complete checklist survey session',
                    informationWithheld: 'None',
                    sex: 'unknown',
                    lifeStage: 'unknown',
                    reproductiveCondition: 'unknown',
                    occurrenceRemarks: 'Complete survey session with zero individuals detected (non-detection)',
                });
            }
        }
    }
    return records;
}
export function exportCaptureHistoryMatrix(individuals, occasions, observations) {
    // Sort occasions chronologically
    const sortedOccasions = [...occasions].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    const occasionIds = sortedOccasions.map((o) => o.id);
    // Map individual sightings: Map<individual_id, Set<session_id>>
    const sightings = new Map();
    for (const obs of observations) {
        if (obs.linked_individual_id) {
            if (!sightings.has(obs.linked_individual_id)) {
                sightings.set(obs.linked_individual_id, new Set());
            }
            sightings.get(obs.linked_individual_id).add(obs.session_id);
        }
    }
    return individuals.map((ind) => {
        const indSessions = sightings.get(ind.id) ?? new Set();
        const history = occasionIds.map((sessionId) => (indSessions.has(sessionId) ? 1 : 0));
        return {
            individual_id: ind.id,
            species: ind.species,
            coat_description: ind.coat_description,
            history,
            occasions: occasionIds,
        };
    });
}
export function exportDistanceSampling(sessions, observations, regionLabel = 'Tunisia') {
    const records = [];
    const transectSessions = sessions.filter((s) => s.protocol === 'transect');
    for (const session of transectSessions) {
        const sessionObs = observations.filter((o) => o.session_id === session.id);
        const effortMeters = (session.distance_km ?? 0) * 1000;
        if (sessionObs.length === 0) {
            // Non-detection session still provides effort
            records.push({
                'Region.Label': regionLabel,
                'Sample.Label': session.id,
                Effort: effortMeters,
                distance: '',
                size: 0,
                species: 'none',
                detected: 0,
            });
        }
        else {
            for (const obs of sessionObs) {
                records.push({
                    'Region.Label': regionLabel,
                    'Sample.Label': session.id,
                    Effort: effortMeters,
                    distance: obs.distance_from_path_m != null ? obs.distance_from_path_m : '',
                    size: obs.group_size,
                    species: obs.species,
                    detected: 1,
                });
            }
        }
    }
    return records;
}
/**
 * Helper to convert array of objects into standard CSV text.
 */
export function objectsToCSV(data) {
    if (data.length === 0)
        return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers
        .map((header) => {
        const val = item[header];
        if (val == null)
            return '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    })
        .join(','));
    return [headers.join(','), ...rows].join('\n');
}
