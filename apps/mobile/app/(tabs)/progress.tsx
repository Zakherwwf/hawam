import React from 'react';
import { router } from 'expo-router';
import { ProgressTab } from '../../src/screens/ProgressTab';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { useSurveyStore } from '../../src/features/survey/surveyStore';

// Progress tab; also reachable at hawem://progress
export default function ProgressRoute() {
  const { setSelectedRouteForSurvey, userAccount } = useAppState();
  return (
    <ProgressTab
      firstName={userAccount?.name?.trim().split(/\s+/)[0]}
      onStartSurvey={() => {
        setSelectedRouteForSurvey(null);
        useSurveyStore.getState().startSurvey('transect');
      }}
      onQuickSighting={() => router.push('/opportunistic')}
      onOpenUploads={() => router.navigate('/activity')}
    />
  );
}
