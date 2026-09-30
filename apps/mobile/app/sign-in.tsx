import React from 'react';
import { AuthGateScreen } from '../src/screens/AuthGateScreen';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function SignInRoute() {
  const { saveAccount } = useAppState();
  return <AuthGateScreen onAuthenticated={(account) => saveAccount(account)} />;
}
