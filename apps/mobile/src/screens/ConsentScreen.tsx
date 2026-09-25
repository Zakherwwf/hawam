import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  I18nManager,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSSegmentedControl, IOSButton, IOSGroupedList, IOSListRow, IOSIcon } from '../components/ios';
import {
  hapticTabSwitch,
  hapticButtonPress,
  hapticSuccess,
} from '../utils/haptics';

interface ConsentScreenProps {
  onAccept: (version: string) => void;
  onLanguageChange: (lang: 'ar' | 'fr' | 'en') => void;
}

export const CURRENT_CONSENT_VERSION = 'v1.0-tn-pasteur';

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ onAccept, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const [agreed, setAgreed] = useState(false);

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.topLanguageRow}>
        <View style={{ width: 280, maxWidth: '92%' }}>
          <IOSSegmentedControl<'ar' | 'fr' | 'en'>
            selectedValue={i18n.language as 'ar' | 'fr' | 'en'}
            onValueChange={(lang) => {
              hapticTabSwitch();
              onLanguageChange(lang);
            }}
            values={[
              { label: 'English', value: 'en' },
              { label: 'Français', value: 'fr' },
              { label: 'العربية', value: 'ar' },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Apple Privacy Splash Header */}
        <View style={styles.splashHeader}>
          <View style={styles.shieldIconWrapper}>
            <IOSIcon name="shield" size={40} color={IOSColors.systemTeal} />
          </View>
          <Text style={styles.splashTitle}>{t('ethics.title')}</Text>
          <Text style={styles.splashWarning}>{t('ethics.warning')}</Text>
        </View>

        {/* Feature List (Apple Onboarding Glyphs) */}
        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: IOSColors.systemTeal }]}>
              <IOSIcon name="shield" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Encrypted Scientific Access</Text>
              <Text style={styles.featureDesc}>{t('ethics.points.0')}</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: IOSColors.systemGreen }]}>
              <IOSIcon name="location" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Spatial Capture-Recapture Modeling</Text>
              <Text style={styles.featureDesc}>{t('ethics.points.1')}</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: IOSColors.systemIndigo }]}>
              <IOSIcon name="trash" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Observer Autonomy & Data Right</Text>
              <Text style={styles.featureDesc}>{t('ethics.points.2')}</Text>
            </View>
          </View>
        </View>

        {/* Inset Group for Agreement Check */}
        <IOSGroupedList>
          <IOSListRow
            title={t('ethics.consent_checkbox')}
            onPress={() => {
              hapticButtonPress();
              setAgreed(!agreed);
            }}
            rightComponent={
              <View style={[styles.appleSwitch, agreed && styles.appleSwitchOn]}>
                <View style={[styles.appleSwitchThumb, agreed && styles.appleSwitchThumbOn]} />
              </View>
            }
            isLast
          />
        </IOSGroupedList>

        <View style={styles.bottomActionContainer}>
          <IOSButton
            title={t('ethics.accept_btn')}
            disabled={!agreed}
            onPress={() => {
              hapticSuccess();
              onAccept(CURRENT_CONSENT_VERSION);
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  </View>
);
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FAF5EE',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topLanguageRow: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(226, 232, 240, 0.7)',
  },
  scrollContent: {
    paddingBottom: 32,
  },
  splashHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
  },
  shieldIconWrapper: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  splashTitle: {
    ...IOSTypography.title1,
    textAlign: 'center',
    marginBottom: 10,
  },
  splashWarning: {
    ...IOSTypography.body,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 22,
  },
  featureList: {
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    ...IOSTypography.headline,
    marginBottom: 3,
  },
  featureDesc: {
    ...IOSTypography.footnote,
    color: IOSColors.secondaryLabel,
    lineHeight: 18,
  },
  appleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: IOSColors.systemGray5,
    padding: 2,
    justifyContent: 'center',
  },
  appleSwitchOn: {
    backgroundColor: IOSColors.systemTeal,
  },
  appleSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  appleSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  bottomActionContainer: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
});
