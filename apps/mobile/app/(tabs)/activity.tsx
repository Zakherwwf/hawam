import React from 'react';
import { router } from 'expo-router';
import { SightingsScreen } from '../../src/screens/SightingsScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { hapticQuickLog } from '../../src/utils/haptics';

export default function ActivityRoute() {
  const { sightings, updateSighting, deleteSighting } = useAppState();
  return (
    <SightingsScreen
      sightings={sightings}
      onAddNew={() => {
        hapticQuickLog();
        router.push('/opportunistic');
      }}
      onUpdateSighting={updateSighting}
      onDeleteSighting={deleteSighting}
    />
  );
}
