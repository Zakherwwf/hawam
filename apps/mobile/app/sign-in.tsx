import React from 'react';
import { AuthGateScreen } from '../src/screens/AuthGateScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';

export default function SignInRoute() {
  const { saveAccount } = useAppState();
  return (
    <ModalFrame background="#F7F6F2" statusBar="dark">
      <AuthGateScreen onAuthenticated={(account) => saveAccount(account)} />
    </ModalFrame>
  );
}
