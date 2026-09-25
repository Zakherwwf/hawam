import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, I18nManager } from 'react-native';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon, IconName } from './IOSIcon';

interface IOSListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName | React.ReactNode;
  iconColor?: string;
  value?: string;
  showDisclosure?: boolean;
  onPress?: () => void;
  isLast?: boolean;
  rightComponent?: React.ReactNode;
  destructive?: boolean;
}

export const IOSListRow: React.FC<IOSListRowProps> = ({
  title,
  subtitle,
  icon,
  iconColor = IOSColors.systemTeal,
  value,
  showDisclosure = false,
  onPress,
  isLast = false,
  rightComponent,
  destructive = false,
}) => {
  const renderIcon = () => {
    if (!icon) return null;
    if (typeof icon === 'string') {
      return (
        <View style={[styles.iconWrapper, { backgroundColor: iconColor }]}>
          <IOSIcon name={icon as IconName} size={16} color="#FFFFFF" />
        </View>
      );
    }
    return (
      <View style={[styles.iconWrapper, { backgroundColor: iconColor }]}>
        {icon}
      </View>
    );
  };

  const content = (
    <View style={styles.container}>
      {renderIcon()}

      <View style={[styles.contentRow, !isLast && styles.contentDivider]}>
        <View style={styles.labelCol}>
          <Text
            style={[
              IOSTypography.body,
              destructive && { color: IOSColors.systemRed },
              I18nManager.isRTL && { textAlign: 'right' },
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={[
                IOSTypography.caption1,
                styles.subtitle,
                I18nManager.isRTL && { textAlign: 'right' },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View style={styles.rightCol}>
          {rightComponent ? (
            rightComponent
          ) : (
            <>
              {value ? <Text style={styles.valueText}>{value}</Text> : null}
              {showDisclosure ? (
                <IOSIcon
                  name={I18nManager.isRTL ? 'chevronLeft' : 'chevronRight'}
                  size={16}
                  color={IOSColors.systemGray3}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.6} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    minHeight: 46,
  },
  iconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingRight: 16,
  },
  contentDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  labelCol: {
    flex: 1,
    justifyContent: 'center',
  },
  subtitle: {
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
  },
});
