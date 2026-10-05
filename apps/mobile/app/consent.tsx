import React from 'react';
import { ConsentScreen } from '../src/screens/ConsentScreen';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function ConsentRoute() {
  const { acceptConsent, changeLanguage } = useAppState();
  return <ConsentScreen onAccept={acceptConsent} onLanguageChange={changeLanguage} />;
}
