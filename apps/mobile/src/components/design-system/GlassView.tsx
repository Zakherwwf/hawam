import React from 'react';
import { View, StyleSheet, ViewProps, Platform } from 'react-native';
import { useThemeStore } from '../../features/theme/themeStore';
import { radius } from '@tunisia-survey/design-tokens';

interface GlassViewProps extends ViewProps {
  intensity?: number;
  cornerRadius?: number;
  elevated?: boolean;
}

/**
 * Liquid Glass floating surface component.
 * Provides translucent backdrop with border highlights and elevation shadow.
 */
export const GlassView: React.FC<GlassViewProps> = ({
  children,
  style,
  cornerRadius = radius.lg,
  elevated = true,
  ...props
}) => {
  const { themeMode } = useThemeStore();
  const isDark = themeMode === 'night';

  const containerStyle = [
    styles.base,
    {
      borderRadius: cornerRadius,
      backgroundColor: isDark
        ? 'rgba(21, 30, 50, 0.82)'
        : 'rgba(255, 255, 255, 0.85)',
      borderColor: isDark
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.08)',
    },
    elevated && (isDark ? styles.darkElevation : styles.lightElevation),
    style,
  ];

  return (
    <View style={containerStyle} {...props}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  lightElevation: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  darkElevation: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.4)',
      },
    }),
  },
});
