import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useThemeStore } from '../../features/theme/themeStore';
import { hapticButtonPress } from '../../utils/haptics';
import { radius, touchTargets } from '@tunisia-survey/design-tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'destructive' | 'ghost';
export type ButtonSize = 'standard' | 'large' | 'hero' | 'lg' | 'sm';

interface ButtonProps {
  label?: string;
  title?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const Button: React.FC<ButtonProps> = ({
  label,
  title,
  onPress,
  variant = 'primary',
  size = 'standard',
  disabled = false,
  loading = false,
  icon,
  style,
  labelStyle,
  accessibilityLabel,
  accessibilityHint,
}) => {
  const { themeMode } = useThemeStore();
  const isDark = themeMode === 'night';

  const handlePress = () => {
    if (disabled || loading) return;
    hapticButtonPress();
    onPress();
  };

  const isLarge = size === 'large' || size === 'hero' || size === 'lg';
  const minHeight = isLarge ? touchTargets.primaryFieldAction : touchTargets.minimum;

  // Background colors based on variant
  const getBackgroundColor = () => {
    if (disabled) return isDark ? '#1F2937' : '#E5E7EB';
    switch (variant) {
      case 'primary':
        return '#0284C7';
      case 'destructive':
        return '#DC2626';
      case 'secondary':
        return isDark ? '#1E293B' : '#F1F5F9';
      case 'glass':
        return isDark ? 'rgba(30, 41, 59, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      case 'ghost':
        return 'transparent';
    }
  };

  // Label text colors based on variant
  const getTextColor = () => {
    if (disabled) return isDark ? '#6B7280' : '#9CA3AF';
    switch (variant) {
      case 'primary':
      case 'destructive':
        return '#FFFFFF';
      case 'secondary':
      case 'glass':
        return isDark ? '#F9FAFB' : '#111827';
      case 'ghost':
        return isDark ? '#38BDF8' : '#0284C7';
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={handlePress}
      disabled={disabled || loading}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.button,
        {
          minHeight,
          height: isLarge ? 64 : 44,
          borderRadius: isLarge ? radius.lg : radius.md,
          backgroundColor: getBackgroundColor(),
          borderColor:
            variant === 'glass' || variant === 'secondary'
              ? isDark
                ? 'rgba(255, 255, 255, 0.12)'
                : 'rgba(0, 0, 0, 0.08)'
              : 'transparent',
          borderWidth: variant === 'glass' || variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text
            style={[
              styles.label,
              {
                color: getTextColor(),
                fontSize: isLarge ? 18 : 15,
                fontWeight: isLarge ? '700' : '600',
                marginLeft: icon ? 8 : 0,
              },
              labelStyle,
            ]}
          >
            {label || title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  label: {
    letterSpacing: -0.2,
  },
});
