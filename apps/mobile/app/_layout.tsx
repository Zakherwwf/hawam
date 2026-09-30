import '../src/i18n';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { AppStateProvider, useAppState } from '../src/app-state/AppStateProvider';
import { queryClient } from '../src/services/queries/useSurveyQueries';
import { IOSColors } from '../src/theme/ios';

function RootNavigator() {
  const { isAuthChecking, userAccount, consentAccepted } = useAppState();
  const signedIn = !!userAccount;
  // While the stored session is being restored, keep the app routes allowed so
  // a deep link opened from a cold start (hawem://settings) is not redirected
  // to sign-in and lost. The loading overlay covers the screen meanwhile.
  const appAllowed = isAuthChecking || (signedIn && consentAccepted);
  const signInAllowed = !isAuthChecking && !signedIn;
  const consentAllowed = !isAuthChecking && signedIn && !consentAccepted;

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Signed in and consented: the app itself */}
        <Stack.Protected guard={appAllowed}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="opportunistic" />
          <Stack.Screen name="guided-photo" options={{ animation: 'fade' }} />
          <Stack.Screen name="training" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="progress" />
        </Stack.Protected>

        {/* Authentication is mandatory before any map or data access */}
        <Stack.Protected guard={signInAllowed}>
          <Stack.Screen name="sign-in" options={{ animation: 'none' }} />
        </Stack.Protected>

        <Stack.Protected guard={consentAllowed}>
          <Stack.Screen name="consent" options={{ animation: 'none' }} />
        </Stack.Protected>
      </Stack>

      {/* Keep the navigator mounted underneath while the session is restored */}
      {isAuthChecking ? (
        <View style={[StyleSheet.absoluteFill, styles.loading]}>
          <StatusBar style="dark" />
          <ActivityIndicator size="large" color={IOSColors.systemTeal} />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AppStateProvider>
          <RootNavigator />
        </AppStateProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    backgroundColor: '#F7F6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
