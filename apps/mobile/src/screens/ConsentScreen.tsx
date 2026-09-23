import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface ConsentScreenProps {
  onAccept: (version: string) => void;
  onLanguageChange: (lang: 'ar' | 'fr' | 'en') => void;
}

export const CURRENT_CONSENT_VERSION = 'v1.0-tn-pasteur';

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ onAccept, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const [agreed, setAgreed] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.langSelector}>
        <TouchableOpacity
          style={[styles.langBtn, i18n.language === 'ar' && styles.langBtnActive]}
          onPress={() => onLanguageChange('ar')}
        >
          <Text style={styles.langText}>عربي</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, i18n.language === 'fr' && styles.langBtnActive]}
          onPress={() => onLanguageChange('fr')}
        >
          <Text style={styles.langText}>Français</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.langBtn, i18n.language === 'en' && styles.langBtnActive]}
          onPress={() => onLanguageChange('en')}
        >
          <Text style={styles.langText}>English</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>🛡️ {t('ethics.title')}</Text>
        </View>

        <Text style={styles.warningText}>{t('ethics.warning')}</Text>

        <View style={styles.card}>
          <Text style={styles.bulletItem}>🔒 {t('ethics.points.0')}</Text>
          <Text style={styles.bulletItem}>🌐 {t('ethics.points.1')}</Text>
          <Text style={styles.bulletItem}>🗑️ {t('ethics.points.2')}</Text>
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>{t('ethics.consent_checkbox')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, !agreed && styles.primaryBtnDisabled]}
          disabled={!agreed}
          onPress={() => onAccept(CURRENT_CONSENT_VERSION)}
        >
          <Text style={styles.primaryBtnText}>{t('ethics.accept_btn')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  langSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  langBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  langBtnActive: {
    backgroundColor: '#0F766E',
  },
  langText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  scrollContent: {
    padding: 24,
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16,
  },
  badgeText: {
    color: '#0F766E',
    fontWeight: 'bold',
    fontSize: 14,
  },
  warningText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#1E293B',
    fontWeight: '600',
    marginBottom: 20,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
    gap: 14,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0F766E',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#0F766E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  primaryBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
