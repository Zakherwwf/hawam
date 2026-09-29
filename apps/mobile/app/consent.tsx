import React from 'react';
import { ConsentScreen } from '../src/screens/ConsentScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function ConsentRoute() {
  const { acceptConsent, changeLanguage } = useAppState();
  return (
    <ModalFrame background="#F7F6F2" statusBar="dark">
      <ConsentScreen onAccept={acceptConsent} onLanguageChange={changeLanguage} />
    </ModalFrame>
  );
}
