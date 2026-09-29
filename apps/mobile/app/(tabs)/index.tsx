import React from 'react';
import { router } from 'expo-router';
import { HomeScreen } from '../../src/screens/HomeScreen';
import { MapOverviewScreen } from '../../src/screens/MapOverviewScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { useSurveyStore } from '../../src/features/survey/surveyStore';
import { hapticButtonPress, hapticQuickLog, hapticTabSwitch } from '../../src/utils/haptics';

// Explore tab: live map, or the dashboard view of it
export default function ExploreRoute() {
  const {
    primaryViewMode,
    setPrimaryViewMode,
    setSelectedRouteForSurvey,
    sightings,
    stats,
    userAccount,
  } = useAppState();

  const openQuickSighting = () => {
    hapticQuickLog();
    router.push('/opportunistic');
  };

  if (primaryViewMode === 'dashboard') {
    return (
      <HomeScreen
        onStartSurvey={() => {
          setSelectedRouteForSurvey(null);
          useSurveyStore.getState().startSurvey('transect');
        }}
        onQuickSighting={openQuickSighting}
        onOpenTraining={() => {
          hapticButtonPress();
          router.push('/training');
        }}
        onOpenSettings={() => {
          hapticButtonPress();
          router.push('/settings');
        }}
        onToggleMap={() => setPrimaryViewMode('map')}
        stats={stats}
        userAccount={userAccount}
      />
    );
  }

  return (
    <MapOverviewScreen
      sightings={sightings}
      onQuickSighting={openQuickSighting}
      onOpenAccount={() => {
        hapticTabSwitch();
        router.navigate('/me');
      }}
      onToggleDashboard={() => setPrimaryViewMode('dashboard')}
      onStartSurvey={(routeId) => {
        setSelectedRouteForSurvey(routeId);
        useSurveyStore.getState().startSurvey('transect', routeId);
      }}
    />
  );
}
