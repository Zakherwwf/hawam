import React from 'react';
import { TrainingScreen } from '../src/screens/TrainingScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function TrainingRoute() {
  const { closeModal } = useAppState();
  return (
    <ModalFrame>
      <TrainingScreen onBack={closeModal} />
    </ModalFrame>
  );
}
