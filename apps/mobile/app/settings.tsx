import React from 'react';
import { SettingsScreen } from '../src/screens/SettingsScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function SettingsRoute() {
  const { closeModal, changeLanguage, sightings, userAccount, signOut } = useAppState();
  return (
    <ModalFrame>
      <SettingsScreen
        onBack={closeModal}
        onLanguageChange={changeLanguage}
        sightings={sightings}
        userAccount={userAccount}
        onAccountDeleted={() => {
          closeModal();
          signOut();
        }}
      />
    </ModalFrame>
  );
}
