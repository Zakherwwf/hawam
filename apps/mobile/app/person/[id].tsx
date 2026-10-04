import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { PersonProfileScreen } from '../../src/screens/PersonProfileScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';

// A volunteer's public profile, opened from the leaderboard
export default function PersonRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { closeModal } = useAppState();
  return <PersonProfileScreen id={String(id)} onBack={closeModal} />;
}
