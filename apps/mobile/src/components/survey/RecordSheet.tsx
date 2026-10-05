import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Gradient,
  Press,
  Sheet,
  Symbol,
  Text,
  useCardShadow,
  useTheme,
  type SymbolName,
} from '../../ui';

/**
 * What the + button opens: three large choices, each saying what it is for
 * and what it is worth, so a first-time volunteer can pick without training.
 */
export function RecordSheet({
  visible,
  onClose,
  onQuickSighting,
  onWalk,
  onStationary,
}: {
  visible: boolean;
  onClose: () => void;
  onQuickSighting: () => void;
  onWalk: () => void;
  onStationary: () => void;
}) {
  const { t } = useTranslation();
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('ui_record.title')}>
      <View style={{ gap: 12 }}>
        <Choice
          icon="camera"
          tile="lime"
          title={t('ui_record.quick')}
          body={t('ui_record.quick_body')}
          tag={t('ui_record.quick_tag')}
          onPress={pick(onQuickSighting)}
          primary
        />
        <Choice
          tile="hero"
          icon="walk"
          title={t('ui_record.walk')}
          body={t('ui_record.walk_body')}
          tag={t('ui_record.walk_tag')}
          onPress={pick(onWalk)}
        />
        <Choice
          tile="ocean"
          icon="timer"
          title={t('ui_record.stationary')}
          body={t('ui_record.stationary_body')}
          tag={t('ui_record.stationary_tag')}
          onPress={pick(onStationary)}
        />
      </View>
    </Sheet>
  );
}

function Choice({
  icon,
  title,
  body,
  tag,
  onPress,
  primary,
  tile,
}: {
  tile: 'lime' | 'hero' | 'ocean';
  icon: SymbolName;
  title: string;
  body: string;
  tag: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { c, g, radius } = useTheme();
  const shadow = useCardShadow();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={`${title}. ${body}. ${tag}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        minHeight: 84,
        borderRadius: radius.lg,
        backgroundColor: c.surface,
        borderWidth: primary ? 2 : 0,
        borderColor: c.lime,
        ...shadow,
      }}
    >
      <Gradient
        colors={g[tile]}
        diagonal
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Symbol
          name={icon}
          size={26}
          color={tile === 'lime' ? c.onLime : '#FFFFFF'}
          weight="semibold"
        />
      </Gradient>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="headline">{title}</Text>
        <Text variant="subhead" tone="ink2">
          {body}
        </Text>
        <Text variant="footnote" tone="accent" weight="600" style={{ marginTop: 2 }}>
          {tag}
        </Text>
      </View>
    </Press>
  );
}
