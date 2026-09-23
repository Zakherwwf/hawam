import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  I18nManager,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSSegmentedControl, IOSButton, IOSGroupedList, IOSListRow } from '../components/ios';

interface ConsentScreenProps {
  onAccept: (version: string) => void;
  onLanguageChange: (lang: 'ar' | 'fr' | 'en') => void;
}

export const CURRENT_CONSENT_VERSION = 'v1.0-tn-pasteur';

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ onAccept, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topLanguageRow}>
        <View style={{ width: 220 }}>
          <IOSSegmentedControl<'ar' | 'fr' | 'en'>
            selectedValue={i18n.language as 'ar' | 'fr' | 'en'}
            onValueChange={onLanguageChange}
            values={[
              { label: 'العربية', value: 'ar' },
              { label: 'Français', value: 'fr' },
              { label: 'English', value: 'en' },
            ]}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Apple Privacy Splash Header */}
        <View style={styles.splashHeader}>
          <View style={styles.shieldIconWrapper}>
            <Text style={styles.shieldEmoji}>🛡️</Text>
          </View>
          <Text style={styles.splashTitle}>{t('ethics.title')}</Text>
          <Text style={styles.splashWarning}>{t('ethics.warning')}</Text>
        </View>

        {/* Feature List (Apple Onboarding Glyphs) */}
        <View style={styles.featureList}>
          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: IOSColors.systemTeal }]}>
              <Text style={styles.featureEmoji}>🔒</Text>
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Chiffrement & Accès Restreint</Text>
              <Text style={styles.featureDesc}>{t('ethics.points.0')}</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: IOSColors.systemGreen }]}>
              <Text style={styles.featureEmoji}>🌐</Text>
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Généralisation Spatiale (1 km²)</Text>
              <Text style={styles.featureDesc}>{t('ethics.points.1')}</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: IOSColors.systemIndigo }]}>
              <Text style={styles.featureEmoji}>🗑️</Text>
            </View>
            <View style={styles.featureTextCol}>
              <Text style={styles.featureTitle}>Droit à l'Oubli Garanti</Text>
              <Text style={styles.featureDesc}>{t('ethics.points.2')}</Text>
            </View>
          </View>
        </View>

        {/* Inset Group for Agreement Check */}
        <IOSGroupedList>
          <IOSListRow
            title={t('ethics.consent_checkbox')}
            onPress={() => setAgreed(!agreed)}
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
            onPress={() => onAccept(CURRENT_CONSENT_VERSION)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  topLanguageRow: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: IOSColors.systemBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  scrollContent: {
    paddingVertical: 20,
  },
  splashHeader: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  shieldIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(48, 176, 199, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  shieldEmoji: {
    fontSize: 32,
  },
  splashTitle: {
    ...IOSTypography.title1,
    textAlign: 'center',
    marginBottom: 8,
  },
  splashWarning: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 21,
  },
  featureList: {
    paddingHorizontal: 24,
    gap: 20,
    marginBottom: 28,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureEmoji: {
    fontSize: 20,
  },
  featureTextCol: {
    flex: 1,
  },
  featureTitle: {
    ...IOSTypography.headline,
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  featureDesc: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    lineHeight: 20,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  appleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: IOSColors.systemGray5,
    padding: 2,
    justifyContent: 'center',
  },
  appleSwitchOn: {
    backgroundColor: IOSColors.systemGreen,
  },
  appleSwitchThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2.5,
  },
  appleSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  bottomActionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
  },
});
