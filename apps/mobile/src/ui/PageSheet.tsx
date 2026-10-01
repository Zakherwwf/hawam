import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Press } from './Press';
import { Text } from './Text';
import { useTheme } from './theme';

/**
 * Full-height sheet for longer tasks (route catalogue, colony forms): a
 * navigation row with Cancel/Done, a title, scrolling content and an optional
 * pinned footer for the main action.
 */
export function PageSheet({
  visible,
  title,
  onClose,
  closeLabel,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'ios' ? 8 : insets.top + 8;
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: c.canvas }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={{
            paddingTop: top,
            paddingHorizontal: 12,
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 52 + top,
          }}
        >
          <Press
            onPress={onClose}
            haptic={false}
            accessibilityLabel={closeLabel ?? t('common.done')}
            style={{ minHeight: 44, minWidth: 72, justifyContent: 'center', paddingHorizontal: 8 }}
          >
            <Text variant="body" tone="accent" weight="600">
              {closeLabel ?? t('common.done')}
            </Text>
          </Press>
          <Text
            variant="headline"
            align="center"
            style={{ flex: 1 }}
            accessibilityRole="header"
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={{ minWidth: 72 }} />
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopWidth: 0.5,
              borderTopColor: c.hairline,
              backgroundColor: c.canvas,
            }}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}
