import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { AnimalProfileScreen } from '../../src/screens/AnimalProfileScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';

// Known animal profile; also reachable at hawem://animal/<id>
export default function AnimalRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { closeModal } = useAppState();
  return <AnimalProfileScreen id={String(id)} onBack={closeModal} />;
}
