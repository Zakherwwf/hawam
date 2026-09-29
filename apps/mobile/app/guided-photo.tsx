import React from 'react';
import { router } from 'expo-router';
import { GuidedPhotoScreen } from '../src/screens/GuidedPhotoScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';
import { hapticModalClose } from '../src/utils/haptics';

export default function GuidedPhotoRoute() {
  const { setCapturedPhotos } = useAppState();
  return (
    <ModalFrame background="#000000" statusBar="light">
      <GuidedPhotoScreen
        onBack={() => {
          hapticModalClose();
          router.back();
        }}
        onFinishCapture={(photos) => {
          setCapturedPhotos(photos);
          router.back();
        }}
      />
    </ModalFrame>
  );
}
