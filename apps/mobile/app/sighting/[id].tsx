import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { SightingProfileScreen } from '../../src/screens/SightingProfileScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';

// Sighting profile; also reachable at hawem://sighting/<id>
export default function SightingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sightings, updateSighting, deleteSighting, closeModal } = useAppState();
  const local = sightings.find((s) => s.id === id) ?? null;
  return (
    <SightingProfileScreen
      id={String(id)}
      local={local}
      onBack={closeModal}
      onSave={updateSighting}
      onDelete={deleteSighting}
    />
  );
}
