import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { IOSColors, IOSTypography } from '../../theme/ios';

interface IOSButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'tinted';
  size?: 'regular' | 'small';
  disabled?: boolean;
  loading?: boolean;
}

export const IOSButton: React.FC<IOSButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'regular',
  disabled = false,
  loading = false,
}) => {
  const isSmall = size === 'small';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        isSmall ? styles.small : styles.regular,
        styles[variant],
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? '#FFF' : IOSColors.systemTeal}
          size="small"
        />
      ) : (
        <Text
          style={[
            isSmall ? IOSTypography.subheadline : IOSTypography.headline,
            styles.textBase,
            variant === 'primary' && styles.primaryText,
            variant === 'secondary' && styles.secondaryText,
            variant === 'tinted' && styles.tintedText,
            variant === 'destructive' && styles.destructiveText,
            disabled && styles.disabledText,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  regular: {
    height: 50,
    paddingHorizontal: 20,
  },
  small: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  primary: {
    backgroundColor: IOSColors.systemTeal,
  },
  secondary: {
    backgroundColor: IOSColors.systemGray5,
  },
  tinted: {
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
  },
  destructive: {
    backgroundColor: IOSColors.systemRed,
  },
  disabled: {
    backgroundColor: IOSColors.systemGray5,
    opacity: 0.6,
  },
  textBase: {
    fontWeight: '600',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: IOSColors.label,
  },
  tintedText: {
    color: IOSColors.systemTeal,
  },
  destructiveText: {
    color: '#FFFFFF',
  },
  disabledText: {
    color: IOSColors.secondaryLabel,
  },
});
