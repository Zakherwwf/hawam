import React from 'react';
import { router } from 'expo-router';
import { ProfileTab } from '../../src/screens/ProfileTab';
import { useAppState } from '../../src/app-state/AppStateProvider';

export default function ProfileRoute() {
  const { userAccount, saveAccount, signOut } = useAppState();
  return (
    <ProfileTab
      userAccount={userAccount}
      authEmail={userAccount?.email}
      onSave={saveAccount}
      onSignOut={signOut}
      onOpenTraining={() => router.push('/training')}
      onOpenSettings={() => router.push('/settings')}
      onOpenProgress={() => router.navigate('/progress')}
    />
  );
}
