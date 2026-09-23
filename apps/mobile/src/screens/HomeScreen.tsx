import React from 'react';
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

interface HomeScreenProps {
  onStartSurvey: () => void;
  onQuickSighting: () => void;
  onOpenTraining: () => void;
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
  stats,
}) => {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.appTitle}>{t('app_name')}</Text>
          <Text style={styles.appTagline}>{t('tagline')}</Text>
        </View>

        {/* Personal Engagement Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>📊 {t('home.stats_title')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.sessionsCompleted}</Text>
              <Text style={styles.statLabel}>{t('home.sessions_completed')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.kmWalked.toFixed(1)}</Text>
              <Text style={styles.statLabel}>{t('home.km_walked')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{stats.animalsRecorded}</Text>
              <Text style={styles.statLabel}>{t('home.animals_recorded')}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {/* 1. Structured Survey (Primary Scientific Backbone) */}
          <TouchableOpacity
            style={[styles.actionCard, styles.surveyCard]}
            onPress={onStartSurvey}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionEmoji}>🗺️</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>{t('home.start_survey_btn')}</Text>
              <Text style={styles.actionSubtitle}>
                {t('survey.transect')} / {t('survey.stationary')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 2. Opportunistic Incidental Sightings */}
          <TouchableOpacity
            style={[styles.actionCard, styles.opportunisticCard]}
            onPress={onQuickSighting}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionEmoji}>📸</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>{t('home.quick_sighting_btn')}</Text>
              <Text style={styles.actionSubtitle}>
                {t('animal.cat')} / {t('animal.dog')} (Incidental)
              </Text>
            </View>
          </TouchableOpacity>

          {/* 3. Training Module */}
          <TouchableOpacity
            style={[styles.actionCard, styles.trainingCard]}
            onPress={onOpenTraining}
            activeOpacity={0.85}
          >
            <View style={styles.actionIconContainer}>
              <Text style={styles.actionEmoji}>🎓</Text>
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>{t('home.training_btn')}</Text>
              <Text style={styles.actionSubtitle}>
                ICAM BCS, Distance, Photo-ID, Non-detections
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scroll: {
    padding: 20,
    gap: 20,
  },
  header: {
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
    marginBottom: 4,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  appTagline: {
    fontSize: 14,
    color: '#64748B',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 16,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F766E',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  actionContainer: {
    gap: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  surveyCard: {
    backgroundColor: '#F0FDFA',
    borderColor: '#99F6E4',
  },
  opportunisticCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  trainingCard: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionTextContainer: {
    flex: 1,
    alignItems: I18nManager.isRTL ? 'flex-end' : 'flex-start',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
});
