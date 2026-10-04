import React from 'react';
import { I18nManager, RefreshControl, ScrollView, View, type ScrollViewProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Press } from './Press';
import { Symbol } from './Symbol';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from './theme';

/** Space the floating tab bar covers at the bottom of every tab screen. */
export function useTabClearance(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12) + 64 + 24;
}

/**
 * A tab or pushed screen: large title, optional subtitle and trailing
 * accessory, scrolling content with the side margin and tab-bar clearance.
 */
export function Screen({
  title,
  subtitle,
  accessory,
  children,
  onRefresh,
  refreshing = false,
  inTabs = true,
  header,
  onBack,
  ...scroll
}: {
  title: string;
  subtitle?: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  inTabs?: boolean;
  /** Replaces the default large title block */
  header?: React.ReactNode;
  /** Pushed screens: a back button above the large title */
  onBack?: () => void;
} & Omit<ScrollViewProps, 'children'>) {
  const { c } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const clearance = useTabClearance();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.canvas }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingHorizontal: 20,
        paddingBottom: inTabs ? clearance : insets.bottom + 24,
      }}
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ink3} />
        ) : undefined
      }
      {...scroll}
    >
      {onBack ? (
        <Press
          onPress={onBack}
          haptic={false}
          accessibilityLabel={t('ui_common.back')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            minHeight: 44,
            alignSelf: 'flex-start',
            marginStart: -8,
            paddingHorizontal: 8,
            marginTop: -8,
          }}
        >
          <Symbol name="chevronLeft" size={20} color={c.accent} weight="semibold" />
          <Text variant="body" tone="accent">
            {t('ui_common.back')}
          </Text>
        </Press>
      ) : null}
      {header ?? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="subhead" tone="ink2" style={{ marginTop: 2 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {accessory}
        </View>
      )}
      {children}
    </ScrollView>
  );
}
