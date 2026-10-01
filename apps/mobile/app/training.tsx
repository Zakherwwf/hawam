import React from 'react';
import { TrainingScreen } from '../src/screens/TrainingScreen';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function TrainingRoute() {
  const { closeModal } = useAppState();
  return <TrainingScreen onBack={closeModal} />;
}
