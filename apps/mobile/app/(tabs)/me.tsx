import React from 'react';
import { router } from 'expo-router';
import { AccountScreen } from '../../src/screens/AccountScreen';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { hapticButtonPress } from '../../src/utils/haptics';

export default function MeRoute() {
  const { userAccount, saveAccount, signOut, sightings, stats } = useAppState();
  return (
    <AccountScreen
      userAccount={userAccount}
      onSaveAccount={saveAccount}
      onSignOut={signOut}
      onOpenTraining={() => {
        hapticButtonPress();
        router.push('/training');
      }}
      onOpenSettings={() => {
        hapticButtonPress();
        router.push('/settings');
      }}
      sightings={sightings}
      stats={stats}
    />
  );
}
