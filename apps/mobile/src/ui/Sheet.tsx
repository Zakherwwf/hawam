import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useReducedMotion, useTheme } from './theme';
import { Text } from './Text';

/** Bottom sheet with a grabber, a title and a dimmed backdrop that closes it. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { c, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    y.setValue(reduced ? 0 : 1);
    if (!reduced) Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, [visible, reduced, y]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('ui_common.close')}
      />
      <Animated.View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.canvas,
          borderTopLeftRadius: radius.lg + 6,
          borderTopRightRadius: radius.lg + 6,
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, 480] }) }],
        }}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 36,
            height: 5,
            borderRadius: 3,
            backgroundColor: c.fill,
            marginTop: 8,
            marginBottom: 12,
          }}
        />
        {title ? (
          <Text variant="title3" accessibilityRole="header" style={{ marginBottom: 16 }}>
            {title}
          </Text>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}
