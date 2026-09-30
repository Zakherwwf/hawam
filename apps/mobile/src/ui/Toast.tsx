import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { Symbol, type SymbolName } from './Symbol';
import { Text } from './Text';
import { useReducedMotion, useTheme } from './theme';

interface ToastMsg {
  id: number;
  title: string;
  detail?: string;
  /** Shown as a "+N XP" pill */
  xp?: number;
  icon?: SymbolName;
}

interface ToastState {
  current: ToastMsg | null;
  show: (m: Omit<ToastMsg, 'id'>) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  current: null,
  show: (m) => set({ current: { ...m, id: Date.now() } }),
  hide: () => set({ current: null }),
}));

/** Celebration toast for saved work and XP. Mounted once, at the root. */
export function ToastHost() {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const msg = useToast((s) => s.current);
  const hide = useToast((s) => s.hide);
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!msg) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility(
      [msg.title, msg.detail, msg.xp ? t('ui_progress_v3.xp_gain', { xp: msg.xp }) : null]
        .filter(Boolean)
        .join('. ')
    );
    a.setValue(reduced ? 1 : 0);
    if (!reduced)
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
    const id = setTimeout(() => {
      if (reduced) hide();
      else
        Animated.timing(a, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
          hide()
        );
    }, 2800);
    return () => clearTimeout(id);
  }, [msg, reduced, a, hide, t]);

  if (!msg) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        zIndex: 10000,
        opacity: a,
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
        ],
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: c.surfaceRaised,
          borderRadius: radius.lg,
          padding: 14,
          borderWidth: 0.5,
          borderColor: c.hairline,
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name={msg.icon ?? 'checkCircle'} size={20} color={c.accent} weight="semibold" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline" numberOfLines={1}>
            {msg.title}
          </Text>
          {msg.detail ? (
            <Text variant="footnote" tone="ink2" numberOfLines={2}>
              {msg.detail}
            </Text>
          ) : null}
        </View>
        {msg.xp ? (
          <View
            style={{
              backgroundColor: c.accent,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text variant="subhead" weight="700" tone="onAccent" tabular>
              {t('ui_progress_v3.xp_gain', { xp: msg.xp })}
            </Text>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}
