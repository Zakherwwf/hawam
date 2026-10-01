import React from 'react';
import { I18nManager, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from './Press';
import { Symbol, type SymbolName } from './Symbol';
import { Text } from './Text';
import { useCardShadow, useTheme } from './theme';

/** Grouped list section: optional header, rounded surface, optional footnote. */
export function Section({
  header,
  footer,
  children,
  style,
  inset = true,
}: {
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** false = content sits on the canvas without the rounded surface */
  inset?: boolean;
}) {
  const { c, radius } = useTheme();
  const shadow = useCardShadow();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ marginBottom: 28 }, style]}>
      {header ? (
        <Text
          variant="footnote"
          tone="ink2"
          style={{ marginHorizontal: 16, marginBottom: 8, textTransform: 'uppercase' }}
        >
          {header}
        </Text>
      ) : null}
      {/* Outer view carries the shadow; the inner one clips pressed rows */}
      <View
        style={
          inset ? [{ backgroundColor: c.surface, borderRadius: radius.lg }, shadow] : undefined
        }
      >
        <View style={inset ? { borderRadius: radius.lg, overflow: 'hidden' } : undefined}>
          {inset
            ? items.map((child, i) => (
                <View key={i}>
                  {child}
                  {i < items.length - 1 ? (
                    <View style={{ height: 0.5, backgroundColor: c.hairline, marginStart: 60 }} />
                  ) : null}
                </View>
              ))
            : children}
        </View>
      </View>
      {footer ? (
        <Text variant="footnote" tone="ink2" style={{ marginHorizontal: 16, marginTop: 8 }}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
}

/** One grouped-list row: icon tile, title and subtitle, trailing detail or control. */
export function Row({
  icon,
  iconColor,
  title,
  subtitle,
  detail,
  onPress,
  chevron = !!onPress,
  toggle,
  destructive,
  trailing,
}: {
  icon?: SymbolName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  detail?: string;
  onPress?: () => void;
  chevron?: boolean;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  destructive?: boolean;
  trailing?: React.ReactNode;
}) {
  const { c } = useTheme();
  const tint = destructive ? c.danger : (iconColor ?? c.accent);
  const body = (
    <View
      style={{
        minHeight: 52,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: destructive ? c.dangerSoft : c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name={icon} size={18} color={tint} weight="medium" />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="body"
          style={destructive ? { color: c.danger } : undefined}
          numberOfLines={2}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="ink2" numberOfLines={3} style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text variant="body" tone="ink2" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {detail}
        </Text>
      ) : null}
      {trailing}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onChange}
          trackColor={{ true: c.accent, false: c.fill }}
          accessibilityLabel={title}
        />
      ) : null}
      {chevron ? (
        <View style={I18nManager.isRTL ? { transform: [{ scaleX: -1 }] } : undefined}>
          <Symbol name="chevronRight" size={14} color={c.ink3} weight="semibold" />
        </View>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Press onPress={onPress} accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}>
      {body}
    </Press>
  );
}
