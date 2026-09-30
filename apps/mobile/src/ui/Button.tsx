import React from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from './Press';
import { Symbol, type SymbolName } from './Symbol';
import { Text } from './Text';
import { useTheme } from './theme';

type Kind = 'primary' | 'secondary' | 'plain' | 'destructive';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  size = 'large',
  style,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  kind?: Kind;
  icon?: SymbolName;
  disabled?: boolean;
  loading?: boolean;
  size?: 'large' | 'small';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { c, radius } = useTheme();
  const bg =
    kind === 'primary'
      ? c.accent
      : kind === 'secondary'
        ? c.accentSoft
        : kind === 'destructive'
          ? c.dangerSoft
          : 'transparent';
  const fg = kind === 'primary' ? c.onAccent : kind === 'destructive' ? c.danger : c.accent;
  const h = size === 'large' ? 52 : 44;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[
        {
          minHeight: h,
          borderRadius: radius.pill,
          backgroundColor: bg,
          paddingHorizontal: kind === 'plain' ? 8 : 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? (
            <Symbol name={icon} size={size === 'large' ? 20 : 17} color={fg} weight="semibold" />
          ) : null}
          <Text
            variant={size === 'large' ? 'headline' : 'subhead'}
            weight="600"
            style={{ color: fg }}
            numberOfLines={1}
          >
            {title}
          </Text>
        </>
      )}
    </Press>
  );
}

/** Round icon-only button (44 pt), for toolbars and map controls. */
export function IconButton({
  icon,
  label,
  onPress,
  tone = 'surface',
  badge,
}: {
  icon: SymbolName;
  label: string;
  onPress: () => void;
  tone?: 'surface' | 'accent' | 'soft';
  badge?: boolean;
}) {
  const { c } = useTheme();
  const bg = tone === 'accent' ? c.accent : tone === 'soft' ? c.accentSoft : c.surface;
  const fg = tone === 'accent' ? c.onAccent : tone === 'soft' ? c.accent : c.ink;
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={4}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Symbol name={icon} size={20} color={fg} weight="medium" />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: c.warning,
            borderWidth: 1.5,
            borderColor: bg,
          }}
        />
      ) : null}
    </Press>
  );
}
