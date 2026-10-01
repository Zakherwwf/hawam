import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAppState } from '../../src/app-state/AppStateProvider';
import { useTheme } from '../../src/ui';

/**
 * Where Google (and email links) send the phone back after signing in:
 * hawem://auth/callback. The tokens in the link are read by the deep-link
 * handler; this page only waits for that, then opens the app. Without it the
 * router showed "Unmatched Route".
 */
export default function AuthCallback() {
  const { isAuthChecking } = useAppState();
  const { c } = useTheme();
  if (!isAuthChecking) return <Redirect href="/" />;
  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.canvas }}
    >
      <ActivityIndicator color={c.accent} />
    </View>
  );
}
