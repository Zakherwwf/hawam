import React from 'react';
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
import { IOSGroupedList, IOSListRow } from '../components/ios';

interface HomeScreenProps {
  onStartSurvey: () => void;
  onQuickSighting: () => void;
  onOpenTraining: () => void;
  onLanguageChange?: (lng: 'ar' | 'fr' | 'en') => void;
  stats: {
    sessionsCompleted: number;
    kmWalked: number;
    animalsRecorded: number;
  };
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartSurvey,
  onQuickSighting,
  onOpenTraining,
  onLanguageChange,
  stats,
}) => {
  const { t, i18n } = useTranslation();

  const cycleLanguage = () => {
    if (!onLanguageChange) return;
    const current = i18n.language;
    if (current === 'ar') onLanguageChange('fr');
    else if (current === 'fr') onLanguageChange('en');
    else onLanguageChange('ar');
  };

  const langLabel = i18n.language === 'ar' ? 'العربية' : i18n.language === 'fr' ? 'Français' : 'English';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navHeader}>
        <View style={styles.navTopRow}>
          <Text style={styles.badgeDate}>
            {new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-TN' : 'fr-FR', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            }).toUpperCase()}
          </Text>
          <TouchableOpacity onPress={cycleLanguage} style={styles.langPill}>
            <Text style={styles.langPillText}>🌐 {langLabel}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.largeTitle}>{t('app_name')}</Text>
        <Text style={styles.tagline}>{t('tagline')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Apple Fitness/Health Activity Rings Style Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>📊 {t('home.stats_title')}</Text>
              <Text style={styles.summaryBadge}>Institut Pasteur</Text>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>{stats.sessionsCompleted}</Text>
                <Text style={styles.metricLabel}>{t('home.sessions_completed')}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>{stats.kmWalked.toFixed(1)}</Text>
                <Text style={styles.metricLabel}>{t('home.km_walked')}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricItem}>
                <Text style={styles.metricVal}>{stats.animalsRecorded}</Text>
                <Text style={styles.metricLabel}>{t('home.animals_recorded')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Primary Citizen-Science Workflows (Apple Inset Grouped Table) */}
        <IOSGroupedList
          header="Protocoles de collecte"
          footer="Toutes les coordonnées géographiques sont automatiquement généralisées à 1 km² avant d'être agrégées, pour protéger les animaux contre les risques d'abattage municipal."
        >
          <IOSListRow
            title={t('home.start_survey_btn')}
            subtitle="Transect linéaire ou point fixe avec tracé GPS continu"
            icon="🧭"
            iconColor={IOSColors.systemTeal}
            showDisclosure
            onPress={onStartSurvey}
          />
          <IOSListRow
            title={t('home.quick_sighting_btn')}
            subtitle="Détection opportuniste rapide (photo + score corporel)"
            icon="📸"
            iconColor={IOSColors.systemOrange}
            showDisclosure
            onPress={onQuickSighting}
          />
          <IOSListRow
            title={t('home.training_btn')}
            subtitle="ICAM 1-5, Distance sampling, photos asymétriques & non-détections"
            icon="🎓"
            iconColor={IOSColors.systemBlue}
            showDisclosure
            isLast
            onPress={onOpenTraining}
          />
        </IOSGroupedList>

        {/* Scientific Data & Ethics Info Group */}
        <IOSGroupedList header="Gouvernance & Éthique">
          <IOSListRow
            title="Charte de protection spatiale"
            subtitle="Coordonnées réelles restreintes aux chercheurs certifiés"
            icon="🛡️"
            iconColor={IOSColors.systemGreen}
            value="Conforme"
          />
          <IOSListRow
            title="Modèles statistiques cibles"
            subtitle="Distance, SECR, Occupancy & N-mixture"
            icon="📈"
            iconColor={IOSColors.systemIndigo}
            value="Actif"
            isLast
          />
        </IOSGroupedList>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  navHeader: {
    backgroundColor: IOSColors.systemBackground,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  navTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeDate: {
    ...IOSTypography.caption1,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  langPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: IOSColors.systemGray6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  langPillText: {
    ...IOSTypography.caption2,
    color: IOSColors.systemTeal,
    fontWeight: '600',
  },
  largeTitle: {
    ...IOSTypography.largeTitle,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  tagline: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  scrollContent: {
    paddingVertical: 16,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryTitle: {
    ...IOSTypography.headline,
  },
  summaryBadge: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricVal: {
    fontSize: 26,
    fontWeight: '800',
    color: IOSColors.systemTeal,
    letterSpacing: -0.5,
  },
  metricLabel: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    textAlign: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: IOSColors.separator,
  },
});
