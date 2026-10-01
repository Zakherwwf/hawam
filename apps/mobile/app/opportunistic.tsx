import React from 'react';
import { QuickSightingScreen } from '../src/screens/QuickSightingScreen';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function QuickSightingRoute() {
  const { closeModal, saveOpportunistic } = useAppState();
  return <QuickSightingScreen onCancel={closeModal} onSave={saveOpportunistic} />;
}
