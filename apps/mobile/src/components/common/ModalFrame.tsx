import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar, StatusBarStyle } from 'expo-status-bar';
import { useThemeStore } from '../../features/theme/themeStore';

/** Full-screen container used by stacked routes (sign-in, consent, modals). */
export function ModalFrame({
  children,
  background,
  statusBar,
}: {
  children: React.ReactNode;
  background?: string;
  statusBar?: StatusBarStyle;
}) {
  const { colors } = useThemeStore();
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: background ?? colors.screenBg }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={statusBar ?? colors.statusBarStyle} />
      {/* fragment: safe-area-context resolves @types/react 18 from the workspace root */}
      <>{children}</>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F6F2' },
});
