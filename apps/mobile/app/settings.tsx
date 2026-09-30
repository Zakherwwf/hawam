import React from 'react';
import { SettingsView } from '../src/screens/SettingsView';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function SettingsRoute() {
  const { closeModal, changeLanguage, signOut } = useAppState();
  return (
    <SettingsView
      onBack={closeModal}
      onLanguageChange={changeLanguage}
      onAccountDeleted={() => {
        closeModal();
        signOut();
      }}
    />
  );
}
