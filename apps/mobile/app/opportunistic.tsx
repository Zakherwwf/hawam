import React from 'react';
import { router } from 'expo-router';
import { OpportunisticScreen } from '../src/screens/OpportunisticScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function OpportunisticRoute() {
  const { closeModal, saveOpportunistic, capturedPhotos, setCapturedPhotos } = useAppState();
  return (
    <ModalFrame>
      <OpportunisticScreen
        onBack={closeModal}
        onOpenPhotoCapture={() => router.push('/guided-photo')}
        onSaveObservation={saveOpportunistic}
        capturedPhotosCount={capturedPhotos.length}
        capturedPhotos={capturedPhotos}
        onClearPhotos={() => setCapturedPhotos([])}
      />
    </ModalFrame>
  );
}
