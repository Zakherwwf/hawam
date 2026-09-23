import React from 'react';
import { View, Text, StyleSheet, I18nManager } from 'react-native';
import { IOSColors, IOSTypography } from '../../theme/ios';

interface IOSGroupedListProps {
  header?: string;
  footer?: string;
  children: React.ReactNode;
}

export const IOSGroupedList: React.FC<IOSGroupedListProps> = ({ header, footer, children }) => {
  return (
    <View style={styles.sectionContainer}>
      {header ? (
        <Text style={[styles.sectionHeader, I18nManager.isRTL && { textAlign: 'right' }]}>
          {header}
        </Text>
      ) : null}

      <View style={styles.card}>{children}</View>

      {footer ? (
        <Text style={[styles.sectionFooter, I18nManager.isRTL && { textAlign: 'right' }]}>
          {footer}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    ...IOSTypography.footnote,
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 16,
    marginRight: 16,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  sectionFooter: {
    ...IOSTypography.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 6,
    marginLeft: 16,
    marginRight: 16,
    lineHeight: 18,
  },
  card: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
  },
});
