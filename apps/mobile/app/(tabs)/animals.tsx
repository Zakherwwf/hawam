import React from 'react';
import { router } from 'expo-router';
import { AnimalsScreen } from '../../src/screens/AnimalsScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { hapticQuickLog } from '../../src/utils/haptics';

export default function AnimalsRoute() {
  const { sightings, updateSighting, deleteSighting } = useAppState();
  return (
    <AnimalsScreen
      sightings={sightings}
      onAddNewSighting={() => {
        hapticQuickLog();
        router.push('/opportunistic');
      }}
      onUpdateSighting={updateSighting}
      onDeleteSighting={deleteSighting}
    />
  );
}
