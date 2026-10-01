import React from 'react';
import { MapTab } from '../../src/screens/MapTab';
import { useAppState } from '../../src/app-state/AppStateProvider';

// Map tab: everyone's sightings
export default function MapRoute() {
  const { mapSightings, refreshMapObservations } = useAppState();
  return <MapTab sightings={mapSightings} onRefresh={refreshMapObservations} />;
}
