import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Native Haptic Feedback Helpers
 * Wraps expo-haptics with platform safety checks to prevent crashes on web or unsupported devices.
 */

/**
 * Subtle selection click for tab switches, segmented controls, and pickers.
 */
export const hapticTabSwitch = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Non-fatal fallback for simulators or devices without haptics
  }
};

/**
 * Crisp medium impact for primary field quick-log buttons (+ Cat, + Dog, FABs).
 */
export const hapticQuickLog = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Non-fatal fallback
  }
};

/**
 * Subtle light click for closing or dismissing modals, sheets, and cards.
 */
export const hapticModalClose = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Non-fatal fallback
  }
};

/**
 * Light impact for interactive pills, chips, and secondary buttons.
 */
export const hapticButtonPress = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Non-fatal fallback
  }
};

/**
 * Celebratory double pulse for milestone achievements, quest claims, and survey completion.
 */
export const hapticSuccess = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Non-fatal fallback
  }
};

/**
 * Tactile warning alert for corridor deviation or critical safety checks.
 */
export const hapticWarning = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Non-fatal fallback
  }
};
