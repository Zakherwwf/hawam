import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Floating tab bar in app/(tabs)/_layout.tsx: 64 pt tall, sitting
// max(insets.bottom + 8, 16) above the screen edge.
const TAB_BAR_HEIGHT = 64;
const BREATHING_ROOM = 24;

/**
 * Bottom padding for scrollable tab screens so the last row (a Save button,
 * an empty-state message) clears the floating tab bar on every device.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom + 8, 16) + TAB_BAR_HEIGHT + BREATHING_ROOM;
}
