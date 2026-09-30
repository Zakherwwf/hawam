import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from './Press';
import { Symbol, type SymbolName } from './Symbol';
import { Text } from './Text';
import { useCardShadow, useTheme } from './theme';

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
  // Selected filters read as dark pills; species filters keep their data colour
  const tint = color ?? c.ink;
  const onTint = color ? c.onAccent : c.canvas;
  return (
    <Press
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={{
        minHeight: 40,
        paddingHorizontal: 16,
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
        <Symbol name={icon} size={15} color={selected ? onTint : c.ink2} weight="medium" />
      ) : null}
      <Text
        variant="subhead"
        weight={selected ? '600' : '400'}
        style={{ color: selected ? onTint : c.ink }}
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
  const shadow = useCardShadow();
  return (
    <View
      style={[
        { backgroundColor: c.surface, borderRadius: radius.lg, padding: padded ? 20 : 0 },
        shadow,
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
  art,
}: {
  /** An illustration shown instead of the icon */
  art?: React.ReactNode;
  icon: SymbolName;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        paddingVertical: art ? 16 : 40,
        paddingHorizontal: 24,
        gap: 10,
      }}
    >
      {art ?? (
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
      )}
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

/** Section title with an optional trailing action ("See all"). */
export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 12,
          marginHorizontal: 4,
          minHeight: 32,
        },
        style,
      ]}
    >
      <Text variant="title3" accessibilityRole="header" style={{ flex: 1 }}>
        {title}
      </Text>
      {action && onAction ? (
        <Press
          onPress={onAction}
          haptic={false}
          accessibilityLabel={action}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 44 }}
        >
          <Text variant="subhead" tone="accent" weight="600">
            {action}
          </Text>
          <Symbol name="chevronRight" size={13} color={c.accent} weight="semibold" />
        </Press>
      ) : null}
    </View>
  );
}

/** Small status pill: "Uploaded", "Waiting", a species. */
export function Tag({
  label,
  tone = 'accent',
}: {
  label: string;
  tone?: 'accent' | 'warning' | 'danger' | 'cat' | 'dog' | 'neutral';
}) {
  const { c, radius } = useTheme();
  const map = {
    accent: [c.accentSoft, c.accent],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    cat: [c.catSoft, c.cat],
    dog: [c.dogSoft, c.dog],
    neutral: [c.fill, c.ink2],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
    >
      <Text variant="caption" weight="600" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Seven small bars (a week), highlighting one; values are plain numbers. */
export function WeekBars({
  values,
  labels,
  highlight,
  height = 64,
  label,
}: {
  values: number[];
  labels: string[];
  highlight: number;
  height?: number;
  label: string;
}) {
  const { c } = useTheme();
  const max = Math.max(...values, 0.0001);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}
    >
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: '100%',
              height,
              justifyContent: 'flex-end',
              borderRadius: 8,
              backgroundColor: c.limeSoft,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: v > 0 ? Math.max(6, (v / max) * height) : 0,
                backgroundColor: i === highlight ? c.accent : c.lime,
                borderRadius: 8,
              }}
            />
          </View>
          <Text
            variant="caption"
            weight={i === highlight ? '700' : '400'}
            tone={i === highlight ? 'ink' : 'ink3'}
          >
            {labels[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}
