import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from './Press';
import { Symbol, type SymbolName } from './Symbol';
import { Text } from './Text';
import { useTheme } from './theme';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: SymbolName;
  /** Data colour (species) when selected; defaults to the accent */
  color?: string;
}) {
  const { c, radius } = useTheme();
  const tint = color ?? c.accent;
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={{
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: selected ? tint : c.surface,
        borderWidth: selected ? 0 : 0.5,
        borderColor: c.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon ? (
        <Symbol name={icon} size={15} color={selected ? c.onAccent : c.ink2} weight="medium" />
      ) : null}
      <Text
        variant="subhead"
        weight={selected ? '600' : '400'}
        style={{ color: selected ? c.onAccent : c.ink }}
      >
        {label}
      </Text>
    </Press>
  );
}

/** iOS segmented control: 2-4 equal options, one selected. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        { flexDirection: 'row', backgroundColor: c.fill, borderRadius: 10, padding: 2 },
        style,
      ]}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Press
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.label}
            style={{
              flex: 1,
              minHeight: 36,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: on ? c.surfaceRaised : 'transparent',
            }}
          >
            <Text variant="subhead" weight={on ? '600' : '400'} numberOfLines={1}>
              {o.label}
            </Text>
          </Press>
        );
      })}
    </View>
  );
}

/** A number and its label; no card. */
export function Stat({
  value,
  label,
  align = 'left',
}: {
  value: string;
  label: string;
  align?: 'left' | 'center';
}) {
  return (
    <View
      style={{ flex: 1, alignItems: align === 'center' ? 'center' : 'flex-start' }}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <Text variant="title2" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text variant="footnote" tone="ink2" numberOfLines={2} align={align}>
        {label}
      </Text>
    </View>
  );
}

/** Plain rounded surface for grouped content that is not a list. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { c, radius } = useTheme();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.lg, padding: padded ? 16 : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: SymbolName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 10 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: c.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Symbol name={icon} size={28} color={c.accent} />
      </View>
      <Text variant="title3" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="subhead" tone="ink2" align="center">
          {message}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: 8, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}
