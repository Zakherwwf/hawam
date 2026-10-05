import React from 'react';
import { router } from 'expo-router';
import { SightingsTab } from '../../src/screens/SightingsTab';
import { useAppState } from '../../src/app-state/AppStateProvider';

export default function SightingsRoute() {
  const { sightings } = useAppState();
  // Opening a sighting goes to its profile (app/sighting/[id].tsx), where it is edited
  return <SightingsTab sightings={sightings} onAddNew={() => router.push('/opportunistic')} />;
}
