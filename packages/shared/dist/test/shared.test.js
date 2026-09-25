import test from 'node:test';
import assert from 'node:assert/strict';
import { generalizeTo1KmGrid, } from '../src/grid.js';
import { exportToDarwinCore, exportCaptureHistoryMatrix, exportDistanceSampling, objectsToCSV, } from '../src/exports.js';
test('1 km grid generalization protects precise locations', () => {
    // Test coordinate in Tunis: Avenue Habib Bourguiba (10.1815, 36.8000)
    const preciseLon = 10.181523;
    const preciseLat = 36.800012;
    const result = generalizeTo1KmGrid(preciseLon, preciseLat);
    assert.ok(result.gridCellId.startsWith('1KM-'));
    assert.equal(result.coordinateUncertaintyInMeters, 707);
    assert.match(result.dataGeneralizations, /1 km grid centroid/);
    assert.match(result.informationWithheld, /restricted to certified researchers/i);
    // Ensure generalized coordinates are distinct from raw micro-degree coordinates
    assert.notEqual(result.centroid[0], preciseLon);
    assert.notEqual(result.centroid[1], preciseLat);
    // Validate difference is within 1km bounding radius (~0.01 deg)
    assert.ok(Math.abs(result.centroid[0] - preciseLon) < 0.01);
    assert.ok(Math.abs(result.centroid[1] - preciseLat) < 0.01);
});
test('Darwin Core exporter handles detections and non-detections', () => {
    const session1 = {
        id: 'sess-001',
        observer_id: 'usr-1',
        protocol: 'transect',
        start_time: '2026-09-23T08:00:00Z',
        end_time: '2026-09-23T09:00:00Z',
        duration_min: 60,
        distance_km: 2.5,
        complete_session: true,
        number_of_observers: 1,
        app_version: '1.0.0',
    };
    const session2Empty = {
        id: 'sess-002',
        observer_id: 'usr-1',
        protocol: 'transect',
        start_time: '2026-09-23T09:30:00Z',
        end_time: '2026-09-23T10:30:00Z',
        duration_min: 60,
        distance_km: 2.0,
        complete_session: true, // Complete checklist with ZERO animals seen
        number_of_observers: 1,
        app_version: '1.0.0',
        track: {
            type: 'LineString',
            coordinates: [[10.18, 36.80], [10.19, 36.81]],
        },
    };
    const obs1 = {
        id: 'obs-001',
        session_id: 'sess-001',
        observer_id: 'usr-1',
        observed_at: '2026-09-23T08:20:00Z',
        location_public: { type: 'Point', coordinates: [10.185, 36.805] },
        grid_cell_id: '1KM-N4084-E1142',
        species: 'cat',
        group_size: 1,
        distance_from_path_m: 12.5,
        sex: 'female',
        age_class: 'adult',
        reproductive_status: 'lactating',
        body_condition_score: 3,
        visible_health_issues: ['none'],
        ear_tip_or_notch: 'yes',
        collar_or_tag: 'no',
        behaviour: 'neutral',
        being_fed_by_people: 'no',
        habitat_type: 'residential',
        food_sources_visible: ['none'],
    };
    const dwc = exportToDarwinCore([session1, session2Empty], [obs1]);
    // Should have 1 presence record + 2 absence records (cat + dog for empty complete session)
    assert.equal(dwc.length, 3);
    const presence = dwc.find((r) => r.occurrenceID === 'obs-001');
    assert.ok(presence);
    assert.equal(presence?.occurrenceStatus, 'present');
    assert.equal(presence?.countryCode, 'TN');
    assert.equal(presence?.scientificName, 'Felis catus');
    assert.match(presence?.dataGeneralizations, /1 km grid/);
    const absences = dwc.filter((r) => r.occurrenceStatus === 'absent');
    assert.equal(absences.length, 2);
    assert.equal(absences[0].eventID, 'sess-002');
    assert.equal(absences[0].individualCount, 0);
});
test('Darwin Core exporter exposes precise coordinates only when explicitly authorized', () => {
    const session = {
        id: 'sess-001',
        observer_id: 'usr-1',
        protocol: 'transect',
        start_time: '2026-09-23T08:00:00Z',
        complete_session: true,
        number_of_observers: 1,
        app_version: '1.0.0',
    };
    const obs = {
        id: 'obs-001',
        session_id: 'sess-001',
        observer_id: 'usr-1',
        observed_at: '2026-09-23T08:20:00Z',
        location_public: { type: 'Point', coordinates: [10.185, 36.805] },
        grid_cell_id: '1KM-TEST',
        species: 'dog',
        group_size: 2,
        sex: 'male',
        age_class: 'adult',
        reproductive_status: 'none_visible',
        body_condition_score: 3,
        visible_health_issues: ['none'],
        ear_tip_or_notch: 'no',
        collar_or_tag: 'no',
        behaviour: 'neutral',
        being_fed_by_people: 'no',
        habitat_type: 'commercial',
        food_sources_visible: ['garbage'],
    };
    const restricted = new Map([
        [
            'obs-001',
            {
                observation_id: 'obs-001',
                location_precise: { type: 'Point', coordinates: [10.1812345, 36.8012345] },
                gps_accuracy_m: 4.2,
            },
        ],
    ]);
    // 1. Without permission -> generalized
    const publicDwc = exportToDarwinCore([session], [obs]);
    assert.equal(publicDwc[0].decimalLatitude, 36.805);
    assert.equal(publicDwc[0].coordinateUncertaintyInMeters, 707);
    // 2. With researcher authorization -> exact
    const researcherDwc = exportToDarwinCore([session], [obs], {
        allowPreciseCoordinates: true,
        restrictedLocations: restricted,
    });
    assert.equal(researcherDwc[0].decimalLatitude, 36.8012345);
    assert.equal(researcherDwc[0].decimalLongitude, 10.1812345);
    assert.equal(researcherDwc[0].coordinateUncertaintyInMeters, 4.2);
});
test('Capture-History Matrix generates binary encounter histories for SECR', () => {
    const individuals = [
        {
            id: 'ind-001',
            species: 'cat',
            coat_description: 'Tabby with white bib',
            first_seen: '2026-09-20',
            last_seen: '2026-09-22',
            confirmed_by: 'researcher-1',
        },
        {
            id: 'ind-002',
            species: 'dog',
            coat_description: 'Yellow short-haired',
            first_seen: '2026-09-21',
            last_seen: '2026-09-21',
            confirmed_by: 'researcher-1',
        },
    ];
    const sessions = [
        { id: 's1', observer_id: 'u1', protocol: 'transect', start_time: '2026-09-20T08:00:00Z', complete_session: true, number_of_observers: 1, app_version: '1' },
        { id: 's2', observer_id: 'u1', protocol: 'transect', start_time: '2026-09-21T08:00:00Z', complete_session: true, number_of_observers: 1, app_version: '1' },
        { id: 's3', observer_id: 'u1', protocol: 'transect', start_time: '2026-09-22T08:00:00Z', complete_session: true, number_of_observers: 1, app_version: '1' },
    ];
    const obs = [
        {
            id: 'o1',
            session_id: 's1',
            observer_id: 'u1',
            observed_at: '2026-09-20T08:15:00Z',
            location_public: { type: 'Point', coordinates: [10, 36] },
            grid_cell_id: 'G1',
            species: 'cat',
            group_size: 1,
            sex: 'male',
            age_class: 'adult',
            reproductive_status: 'none_visible',
            body_condition_score: 3,
            visible_health_issues: ['none'],
            ear_tip_or_notch: 'no',
            collar_or_tag: 'no',
            behaviour: 'neutral',
            being_fed_by_people: 'no',
            habitat_type: 'residential',
            food_sources_visible: [],
            linked_individual_id: 'ind-001',
        },
        {
            id: 'o2',
            session_id: 's3',
            observer_id: 'u1',
            observed_at: '2026-09-22T08:15:00Z',
            location_public: { type: 'Point', coordinates: [10, 36] },
            grid_cell_id: 'G1',
            species: 'cat',
            group_size: 1,
            sex: 'male',
            age_class: 'adult',
            reproductive_status: 'none_visible',
            body_condition_score: 3,
            visible_health_issues: ['none'],
            ear_tip_or_notch: 'no',
            collar_or_tag: 'no',
            behaviour: 'neutral',
            being_fed_by_people: 'no',
            habitat_type: 'residential',
            food_sources_visible: [],
            linked_individual_id: 'ind-001',
        },
    ];
    const history = exportCaptureHistoryMatrix(individuals, sessions, obs);
    assert.equal(history.length, 2);
    const ind1 = history.find((h) => h.individual_id === 'ind-001');
    // S1=seen (1), S2=not seen (0), S3=seen (1)
    assert.deepEqual(ind1?.history, [1, 0, 1]);
    const ind2 = history.find((h) => h.individual_id === 'ind-002');
    // S1=0, S2=0, S3=0 (no observation linked)
    assert.deepEqual(ind2?.history, [0, 0, 0]);
});
test('Distance sampling export produces valid R format with effort and detection distances', () => {
    const sessions = [
        {
            id: 'transect-1',
            observer_id: 'u1',
            protocol: 'transect',
            start_time: '2026-09-23T08:00:00Z',
            distance_km: 1.5,
            complete_session: true,
            number_of_observers: 1,
            app_version: '1',
        },
    ];
    const obs = [
        {
            id: 'o1',
            session_id: 'transect-1',
            observer_id: 'u1',
            observed_at: '2026-09-23T08:10:00Z',
            location_public: { type: 'Point', coordinates: [10, 36] },
            grid_cell_id: 'G1',
            species: 'cat',
            group_size: 2,
            distance_from_path_m: 8.5,
            sex: 'female',
            age_class: 'adult',
            reproductive_status: 'none_visible',
            body_condition_score: 3,
            visible_health_issues: ['none'],
            ear_tip_or_notch: 'no',
            collar_or_tag: 'no',
            behaviour: 'neutral',
            being_fed_by_people: 'no',
            habitat_type: 'residential',
            food_sources_visible: [],
        },
    ];
    const distRecords = exportDistanceSampling(sessions, obs, 'Tunis');
    assert.equal(distRecords.length, 1);
    assert.equal(distRecords[0]['Region.Label'], 'Tunis');
    assert.equal(distRecords[0]['Sample.Label'], 'transect-1');
    assert.equal(distRecords[0].Effort, 1500); // 1.5 km = 1500m
    assert.equal(distRecords[0].distance, 8.5);
    assert.equal(distRecords[0].size, 2);
    assert.equal(distRecords[0].detected, 1);
    const csv = objectsToCSV(distRecords);
    assert.match(csv, /Sample\.Label,Effort,distance,size/);
    assert.match(csv, /"transect-1","1500","8.5","2"/);
});
