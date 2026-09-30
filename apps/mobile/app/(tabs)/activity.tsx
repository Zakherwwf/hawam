import React from 'react';
import { router } from 'expo-router';
import { SightingsTab } from '../../src/screens/SightingsTab';
import { useAppState } from '../../src/app-state/AppStateProvider';

export default function SightingsRoute() {
  const { sightings, updateSighting, deleteSighting } = useAppState();
  return (
    <SightingsTab
      sightings={sightings}
      onAddNew={() => router.push('/opportunistic')}
      onUpdateSighting={updateSighting}
      onDeleteSighting={deleteSighting}
    />
  );
}
