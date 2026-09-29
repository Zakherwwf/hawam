import React from 'react';
import { ProgressScreen } from '../src/screens/ProgressScreen';
import { ModalFrame } from '../src/components/common/ModalFrame';
import { useAppState } from '../src/app-state/AppStateProvider';

// Leaderboard and badges; reachable at hawem://progress
export default function ProgressRoute() {
  const { userAccount, stats } = useAppState();
  return (
    <ModalFrame>
      <ProgressScreen userAccount={userAccount} stats={stats} />
    </ModalFrame>
  );
}
