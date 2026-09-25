import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { IOSColors, IOSTypography } from '../../theme/ios';

interface IOSNavigationBarProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backTitle?: string;
  rightAction?: React.ReactNode;
  largeTitle?: boolean;
}

export const IOSNavigationBar: React.FC<IOSNavigationBarProps> = ({
  title,
  subtitle,
  onBack,
  backTitle = '‹ Retour',
  rightAction,
  largeTitle = false,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        <View style={styles.leftCol}>
          {onBack ? (
            <TouchableOpacity onPress={onBack} hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }} style={styles.backBtn}>
              <Text style={styles.backText}>{I18nManager.isRTL ? '›' : '‹'} {backTitle.replace(/[‹›]/g, '').trim()}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!largeTitle ? (
          <View style={styles.centerCol}>
            <Text style={styles.inlineTitle} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.inlineSub} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        ) : (
          <View style={styles.centerCol} />
        )}

        <View style={styles.rightCol}>
          {rightAction}
        </View>
      </View>

      {largeTitle ? (
        <View style={styles.largeTitleContainer}>
          <Text style={IOSTypography.largeTitle}>{title}</Text>
          {subtitle ? <Text style={IOSTypography.subheadline}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: IOSColors.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  topRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftCol: {
    minWidth: 70,
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  centerCol: {
    flex: 1,
    alignItems: 'center',
  },
  rightCol: {
    minWidth: 70,
    alignItems: I18nManager.isRTL ? 'flex-start' : 'flex-end',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    ...IOSTypography.body,
    color: IOSColors.systemTeal,
    fontWeight: '400',
  },
  inlineTitle: {
    ...IOSTypography.headline,
    textAlign: 'center',
  },
  inlineSub: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
  },
  largeTitleContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
});
