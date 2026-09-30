import test from 'node:test';
import assert from 'node:assert/strict';
import { getGpsQuality, POCKET_SAFE_DELAY_MS } from '../components/survey/hudUtils.ts';
import { useSurveyStore } from '../features/survey/surveyStore.ts';

test('workoutHud: getGpsQuality correctly categorizes GPS accuracy levels', () => {
  // Good: <= 10m
  const goodHigh = getGpsQuality(3.2);
  assert.equal(goodHigh.level, 'good');
  assert.ok(goodHigh.label.includes('GOOD'));
  assert.ok(goodHigh.label.includes('3m'));

  const goodBoundary = getGpsQuality(10.0);
  assert.equal(goodBoundary.level, 'good');

  // Fair: > 10m and <= 25m
  const fair = getGpsQuality(18.5);
  assert.equal(fair.level, 'fair');
  assert.ok(fair.label.includes('FAIR'));
  assert.ok(fair.label.includes('19m'));

  const fairBoundary = getGpsQuality(25.0);
  assert.equal(fairBoundary.level, 'fair');

  // Poor: > 25m
  const poor = getGpsQuality(35.0);
  assert.equal(poor.level, 'poor');
  assert.ok(poor.label.includes('POOR'));

  // Invalid or undefined accuracy defaults to Poor
  const undef = getGpsQuality(undefined);
  assert.equal(undef.level, 'poor');

  const zero = getGpsQuality(0);
  assert.equal(zero.level, 'poor');

  // Paused state takes precedence over accuracy
  const paused = getGpsQuality(2.0, true);
  assert.equal(paused.level, 'paused');
  assert.equal(paused.label, 'PAUSED');
});

test('workoutHud: POCKET_SAFE_DELAY_MS enforces 600ms pocket safety threshold', () => {
  assert.equal(
    POCKET_SAFE_DELAY_MS,
    600,
    'Pocket safety threshold must be 600ms to prevent accidental finish/pause in pockets'
  );
});

test('workoutHud: rapid 1-tap logging persists the observation without invented values', () => {
  const store = useSurveyStore.getState();
  store.resetSurvey();
  store.startSurvey('transect');
  useSurveyStore.setState({
    status: 'recording',
    currentLocation: { lat: 36.8065, lon: 10.1815, accuracy: 3.5, heading: 180 },
  });

  assert.equal(useSurveyStore.getState().detections.length, 0);

  // 1-Tap Cat Log (simulating WorkoutHUD onLogCat)
  const catDetection = store.logDetection({
    species: 'cat',
    gps_accuracy_m: 3.5,
  });

  assert.ok(catDetection.id);
  assert.equal(catDetection.species, 'cat');
  assert.equal(catDetection.body_condition_score, undefined, 'BCS stays unset until assessed');
  assert.equal(catDetection.distance_estimate_m, undefined, 'No default distance');
  assert.equal(catDetection.perpendicular_distance_m, undefined);
  assert.equal(
    catDetection.animal_lat,
    36.8065,
    'Without an estimate the animal is placed at the observer'
  );
  assert.equal(catDetection.group_size, 1, 'Default group size must be 1');
  assert.equal(useSurveyStore.getState().detections.length, 1);

  // 1-Tap Dog Log (simulating WorkoutHUD onLogDog)
  const dogDetection = store.logDetection({
    species: 'dog',
    gps_accuracy_m: 3.5,
  });

  assert.ok(dogDetection.id);
  assert.equal(dogDetection.species, 'dog');
  assert.equal(dogDetection.body_condition_score, undefined);
  assert.equal(dogDetection.group_size, 1);

  const finalDetections = useSurveyStore.getState().detections;
  assert.equal(finalDetections.length, 2);
  assert.equal(finalDetections[0].species, 'dog');
  assert.equal(finalDetections[1].species, 'cat');
});

test('surveyStore: low-accuracy fixes are kept as raw points but never add distance', () => {
  const store = useSurveyStore.getState();
  store.resetSurvey();
  store.startSurvey('transect');
  useSurveyStore.setState({ status: 'recording' });
  store.addTrackPoint(36.8, 10.18, 5, 1);
  store.addTrackPoint(36.8005, 10.18, 45, 1); // ~55 m away but 45 m accuracy
  store.addTrackPoint(36.8003, 10.18, 6, 1); // ~33 m, good fix
  const st = useSurveyStore.getState();
  assert.equal(st.rawTrackPoints.length, 3, 'all fixes are retained');
  assert.equal(st.activeTrack.length, 2, 'the weak fix is not on the walked line');
  assert.ok(st.distanceMeters > 30 && st.distanceMeters < 40, `distance ${st.distanceMeters}`);
});
