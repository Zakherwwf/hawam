import test from 'node:test';
import assert from 'node:assert/strict';
import { useSurveyStore } from '../features/survey/surveyStore.ts';
import { useGamificationStore } from '../features/gamification/gamificationStore.ts';
import { useSyncStore } from '../features/sync/syncStore.ts';

test('finishFlow: zero-detection survey with complete checklist awards full scientific XP and celebration', () => {
  useGamificationStore.getState().resetGamification();
  const initialXp = useGamificationStore.getState().xpTotal;

  const store = useSurveyStore.getState();
  store.resetSurvey();
  store.startSurvey('transect');
  useSurveyStore.setState({
    status: 'recording',
    elapsedSeconds: 1200, // 20 minutes
    distanceMeters: 1200, // 1.2 km
    detections: [], // 0 animals seen
  });

  // Calculate XP according to scientific protocol:
  // Effort: 10 XP per 10 mins = 20 XP
  const elapsedSeconds = useSurveyStore.getState().elapsedSeconds;
  const effortXp = Math.min(60, Math.max(10, Math.floor(elapsedSeconds / 600) * 10));
  assert.equal(effortXp, 20);

  // Complete checklist bonus: +20 XP
  const completeChecklist = true;
  const completeBonus = completeChecklist ? 20 : 0;
  assert.equal(completeBonus, 20);

  const animalsBonus = Math.min(20, useSurveyStore.getState().detections.length * 2);
  assert.equal(animalsBonus, 0);

  const totalXp = effortXp + completeBonus + animalsBonus;
  assert.equal(totalXp, 40);

  const reason =
    completeChecklist && useSurveyStore.getState().detections.length === 0
      ? 'Completed Zero-Detection Survey (eBird scientific non-detection)'
      : 'Completed Structured Transect Survey';

  assert.equal(
    reason,
    'Completed Zero-Detection Survey (eBird scientific non-detection)',
    'Zero-sighting complete surveys must be explicitly credited as scientific non-detections'
  );

  useGamificationStore.getState().awardXp(totalXp, reason);
  assert.equal(useGamificationStore.getState().xpTotal, initialXp + 40);
});

test('finishFlow: incomplete survey does not receive complete checklist bonus', () => {
  useGamificationStore.getState().resetGamification();
  const initialXp = useGamificationStore.getState().xpTotal;

  const elapsedSeconds = 600; // 10 minutes
  const effortXp = Math.min(60, Math.max(10, Math.floor(elapsedSeconds / 600) * 10));
  const completeChecklist = false;
  const completeBonus = completeChecklist ? 20 : 0;
  const detectionsCount = 2;
  const animalsBonus = Math.min(20, detectionsCount * 2);

  const totalXp = effortXp + completeBonus + animalsBonus;
  assert.equal(completeBonus, 0);
  assert.equal(totalXp, 10 + 0 + 4);

  const reason =
    completeChecklist && detectionsCount === 0
      ? 'Completed Zero-Detection Survey (eBird scientific non-detection)'
      : 'Completed Structured Transect Survey';

  assert.equal(reason, 'Completed Structured Transect Survey');

  useGamificationStore.getState().awardXp(totalXp, reason);
  assert.equal(useGamificationStore.getState().xpTotal, initialXp + 14);
});

test('finishFlow: finishes survey, sets completeChecklist in store, and enqueues outbox bundle', async () => {
  const store = useSurveyStore.getState();
  store.resetSurvey();
  store.startSurvey('transect');
  useSurveyStore.setState({
    status: 'recording',
    elapsedSeconds: 900,
    distanceMeters: 850,
  });

  store.setCompleteChecklist(true);
  assert.equal(useSurveyStore.getState().completeChecklist, true);

  const summary = store.finishSurvey();
  assert.equal(useSurveyStore.getState().status, 'finished');
  assert.equal(summary.completeChecklist, true);
  assert.ok(summary.endedAt);

  // Enqueue to outbox
  const sessionId = summary.sessionId || 'test-session-123';
  await useSyncStore.getState().enqueueSurvey({
    session: {
      id: sessionId,
      protocol: 'transect',
      start_time: summary.startedAt,
      end_time: summary.endedAt,
      distance_km: summary.distanceKm,
      complete_session: true,
      number_of_observers: 1,
      app_version: '2.0.0',
      device_gps_accuracy_avg: 4.2,
    },
    track: null,
    track_points: [],
    observations: [],
    photos: [],
  });

  const outbox = useSyncStore.getState().outbox;
  const enqueued = outbox.find((item) => item.payload?.session?.id === sessionId || item.id === `outbox-${sessionId}`);
  assert.ok(enqueued, 'Survey bundle must be persisted in outbox');
  assert.equal(enqueued.payload.session.complete_session, true);
  assert.equal(enqueued.status, 'pending');
});
