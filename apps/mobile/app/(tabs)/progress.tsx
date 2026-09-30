import React from 'react';
import { ProgressTab } from '../../src/screens/ProgressTab';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { useSurveyStore } from '../../src/features/survey/surveyStore';

// Progress tab; also reachable at hawem://progress
export default function ProgressRoute() {
  const { setSelectedRouteForSurvey } = useAppState();
  return (
    <ProgressTab
      onStartSurvey={() => {
        setSelectedRouteForSurvey(null);
        useSurveyStore.getState().startSurvey('transect');
      }}
    />
  );
}
