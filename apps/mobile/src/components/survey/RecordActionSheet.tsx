import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../features/theme/themeStore';
import { Icon } from '../design-system/Icon';
import { radius, spacing } from '@tunisia-survey/design-tokens';
import { hapticModalClose, hapticButtonPress } from '../../utils/haptics';

interface RecordActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectTransect: () => void;
  onSelectStationary: () => void;
  onSelectQuickSighting: () => void;
}

export const RecordActionSheet: React.FC<RecordActionSheetProps> = ({
  visible,
  onClose,
  onSelectTransect,
  onSelectStationary,
  onSelectQuickSighting,
}) => {
  const insets = useSafeAreaInsets();
  const { themeMode } = useThemeStore();
  const isDark = themeMode === 'night';

  const handleAction = (callback: () => void) => {
    hapticButtonPress();
    onClose();
    callback();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {
        hapticModalClose();
        onClose();
      }}
    >
      <TouchableWithoutFeedback
        onPress={() => {
          hapticModalClose();
          onClose();
        }}
      >
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: isDark ? '#151E32' : '#FFFFFF',
                  paddingBottom: Math.max(insets.bottom + 16, 24),
                },
              ]}
            >
              {/* Grabber indicator */}
              <View style={styles.grabberContainer}>
                <View
                  style={[
                    styles.grabber,
                    { backgroundColor: isDark ? '#374151' : '#E5E7EB' },
                  ]}
                />
              </View>

              <Text
                style={[
                  styles.title,
                  { color: isDark ? '#F9FAFB' : '#111827' },
                ]}
              >
                Record Observations
              </Text>
              <Text
                style={[
                  styles.subtitle,
                  { color: isDark ? '#9CA3AF' : '#6B7280' },
                ]}
              >
                Choose scientific protocol or log an immediate sighting
              </Text>

              {/* Action 1: Transect Survey */}
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
                onPress={() => handleAction(onSelectTransect)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#0284C7' }]}>
                  <Icon name="survey" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.actionDetails}>
                  <Text
                    style={[
                      styles.actionTitle,
                      { color: isDark ? '#F9FAFB' : '#0F172A' },
                    ]}
                  >
                    Transect Survey
                  </Text>
                  <Text
                    style={[
                      styles.actionDescription,
                      { color: isDark ? '#9CA3AF' : '#64748B' },
                    ]}
                  >
                    Walk a fixed or free route with GPS effort & distance tracking
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={isDark ? '#6B7280' : '#94A3B8'} />
              </TouchableOpacity>

              {/* Action 2: Stationary Point Count */}
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
                onPress={() => handleAction(onSelectStationary)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#0D9488' }]}>
                  <Icon name="compass" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.actionDetails}>
                  <Text
                    style={[
                      styles.actionTitle,
                      { color: isDark ? '#F9FAFB' : '#0F172A' },
                    ]}
                  >
                    Stationary Point Count
                  </Text>
                  <Text
                    style={[
                      styles.actionDescription,
                      { color: isDark ? '#9CA3AF' : '#64748B' },
                    ]}
                  >
                    Record animal density at a single observation point for 5–15 min
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={isDark ? '#6B7280' : '#94A3B8'} />
              </TouchableOpacity>

              {/* Action 3: Quick Sighting */}
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
                onPress={() => handleAction(onSelectQuickSighting)}
                activeOpacity={0.75}
              >
                <View style={[styles.iconCircle, { backgroundColor: '#D97706' }]}>
                  <Icon name="animals" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.actionDetails}>
                  <Text
                    style={[
                      styles.actionTitle,
                      { color: isDark ? '#F9FAFB' : '#0F172A' },
                    ]}
                  >
                    Quick Sighting
                  </Text>
                  <Text
                    style={[
                      styles.actionDescription,
                      { color: isDark ? '#9CA3AF' : '#64748B' },
                    ]}
                  >
                    Instantly capture a free-roaming cat or dog sighting with photo
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={isDark ? '#6B7280' : '#94A3B8'} />
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                  },
                ]}
                onPress={() => {
                  hapticModalClose();
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.cancelText,
                    { color: isDark ? '#E5E7EB' : '#475569' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  grabberContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  actionDetails: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    lineHeight: 17,
  },
  cancelButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
