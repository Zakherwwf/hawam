import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  TouchableOpacity,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { generalizeTo1KmGrid } from '@tunisia-survey/shared';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSNavigationBar, IOSGroupedList, IOSListRow, IOSIcon, IOSButton } from '../components/ios';
import { setAppLanguage } from '../i18n';
import { useSyncStore } from '../features/sync/syncStore';
import { useThemeStore } from '../features/theme/themeStore';
import { SightingItem } from './SightingsScreen';
import { UserAccount } from './AccountScreen';

interface SettingsScreenProps {
  onLanguageChange?: (lng: 'ar' | 'fr' | 'en') => void;
  onBack?: () => void;
  sightings?: SightingItem[];
  userAccount?: UserAccount | null;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLanguageChange,
  onBack,
  sightings = [],
  userAccount,
}) => {
  const { t, i18n } = useTranslation();
  const { isSyncing, lastSyncedAt, pendingCount, triggerSync } = useSyncStore();
  const { themeMode, colors, toggleTheme } = useThemeStore();

  const [exactCoordsEnabled, setExactCoordsEnabled] = useState(true);
  const [accuracyThreshold, setAccuracyThreshold] = useState('5m');
  const [isExporting, setIsExporting] = useState(false);

  const currentLang = i18n.language || 'en';

  // Simulated live georeference calculation
  const demoLat = 36.8065;
  const demoLon = 10.1815;
  const gridInfo = generalizeTo1KmGrid(demoLon, demoLat);

  const handleSelectLanguage = (lng: 'ar' | 'fr' | 'en') => {
    setAppLanguage(lng);
    if (onLanguageChange) {
      onLanguageChange(lng);
    }
  };

  const handleTriggerSync = async () => {
    try {
      const res = await triggerSync();
      Alert.alert(
        'Cloud Synchronization',
        res.success
          ? `Successfully synchronized ${res.syncedCount} queued record(s) to PostgreSQL PostGIS database.`
          : 'Sync completed. Remaining records held safely in offline outbox.'
      );
    } catch (err: any) {
      Alert.alert('Sync Offline', err?.message || 'Database gateway temporarily unavailable.');
    }
  };

  const handleExportDwCA = async () => {
    setIsExporting(true);
    try {
      const records = sightings.map((s, idx) => {
        const lat = exactCoordsEnabled ? s.latitude.toFixed(6) : (Math.round(s.latitude * 100) / 100).toFixed(4);
        const lon = exactCoordsEnabled ? s.longitude.toFixed(6) : (Math.round(s.longitude * 100) / 100).toFixed(4);
        return [
          `urn:catalog:IPT:HAWEM:${s.id}`,
          'HumanObservation',
          s.species === 'cat' ? 'Felis catus' : 'Canis lupus familiaris',
          s.species === 'cat' ? 'Domestic Cat' : 'Domestic Dog',
          s.group_size || 1,
          s.observed_at,
          lat,
          lon,
          'WGS84',
          exactCoordsEnabled ? '5' : '1000',
          'Tunisia',
          'TN',
          'Institut Pasteur de Tunis',
        ].join(',');
      });

      const header = 'occurrenceID,basisOfRecord,scientificName,vernacularName,individualCount,eventDate,decimalLatitude,decimalLongitude,geodeticDatum,coordinateUncertaintyInMeters,country,countryCode,institutionCode';
      const csv = `${header}\n${records.join('\n')}`;

      await Share.share({
        title: 'Hawem Darwin Core Archive (DwC-A)',
        message: csv,
      });
    } catch (e) {
      console.warn('Share error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportSECR = async () => {
    setIsExporting(true);
    try {
      const rows = sightings.map((s) => [
        s.id,
        s.species,
        s.observed_at.slice(0, 10),
        s.distance_from_path_m !== undefined ? s.distance_from_path_m.toFixed(1) : '5.0',
        s.latitude.toFixed(6),
        s.longitude.toFixed(6),
        s.body_condition_score || 3,
      ].join(','));

      const header = 'session_id,species,date,perpendicular_distance_m,animal_lat,animal_lon,body_condition_score';
      const csv = `${header}\n${rows.join('\n')}`;

      await Share.share({
        title: 'Hawem SECR & Distance Sampling Matrix',
        message: csv,
      });
    } catch (e) {
      console.warn('SECR Export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.screenBg }]} edges={['top', 'left', 'right']}>
      <IOSNavigationBar
        title={t('settings.title')}
        onBack={onBack}
        backTitle={t('nav.home')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Visual Appearance & Theme Group */}
        <IOSGroupedList
          header="Appearance & Visuals"
          footer="Switch between soft porcelain daylight palette and nocturnal OLED contrast mode."
        >
          <IOSListRow
            title={themeMode === 'night' ? 'Night Mode (Nocturnal)' : 'Day Mode (Standard)'}
            subtitle={themeMode === 'night' ? 'Dark high-contrast palette for evening surveys' : 'Porcelain daylight palette'}
            icon={themeMode === 'night' ? 'moon' : 'sun'}
            iconColor={themeMode === 'night' ? '#818CF8' : '#F59E0B'}
            isLast
            rightComponent={
              <Switch
                value={themeMode === 'night'}
                onValueChange={toggleTheme}
                trackColor={{ false: IOSColors.systemGray5, true: '#4F46E5' }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </IOSGroupedList>

        {/* Language Selection Group */}
        <IOSGroupedList
          header={t('settings.language_header')}
          footer={t('settings.language_footer')}
        >
          <IOSListRow
            title="English"
            subtitle="Default language"
            icon="globe"
            iconColor={IOSColors.systemBlue}
            rightComponent={
              currentLang === 'en' ? (
                <IOSIcon name="check" size={18} color={IOSColors.systemTeal} />
              ) : null
            }
            onPress={() => handleSelectLanguage('en')}
          />
          <IOSListRow
            title="Français"
            subtitle="Terminologie francophone"
            icon="globe"
            iconColor={IOSColors.systemIndigo}
            rightComponent={
              currentLang === 'fr' ? (
                <IOSIcon name="check" size={18} color={IOSColors.systemTeal} />
              ) : null
            }
            onPress={() => handleSelectLanguage('fr')}
          />
          <IOSListRow
            title="العربية (تونس)"
            subtitle="اللغة العربية - استمارات الحقل"
            icon="globe"
            iconColor={IOSColors.systemGreen}
            isLast
            rightComponent={
              currentLang === 'ar' ? (
                <IOSIcon name="check" size={18} color={IOSColors.systemTeal} />
              ) : null
            }
            onPress={() => handleSelectLanguage('ar')}
          />
        </IOSGroupedList>

        {/* Georeferencing & Spatial Precision Group */}
        <IOSGroupedList
          header={t('settings.georeferencing_header')}
          footer={t('settings.georeferencing_footer')}
        >
          <IOSListRow
            title={t('settings.exact_coords_title')}
            subtitle={t('settings.exact_coords_sub')}
            icon="location"
            iconColor={IOSColors.systemTeal}
            rightComponent={
              <Switch
                value={exactCoordsEnabled}
                onValueChange={setExactCoordsEnabled}
                trackColor={{ false: IOSColors.systemGray5, true: IOSColors.systemTeal }}
              />
            }
          />
          <IOSListRow
            title={t('settings.gps_threshold_title')}
            subtitle="Minimum GPS lock quality for waypoints"
            icon="ruler"
            iconColor={IOSColors.systemOrange}
            value={`±${accuracyThreshold}`}
            showDisclosure
            onPress={() => {
              const next = accuracyThreshold === '5m' ? '10m' : accuracyThreshold === '10m' ? '20m' : '5m';
              setAccuracyThreshold(next);
            }}
          />
          <IOSListRow
            title={t('settings.datum_title')}
            subtitle="Geodetic datum & projection grid"
            icon="map"
            iconColor={IOSColors.systemPurple}
            value={t('settings.datum_val')}
          />
          <IOSListRow
            title="Generalization Grid Cell"
            subtitle={`Centroid: ${gridInfo.centroid[1].toFixed(4)}°N, ${gridInfo.centroid[0].toFixed(4)}°E`}
            icon="squareStack"
            iconColor={IOSColors.systemGreen}
            value={gridInfo.gridCellId}
            isLast
          />
        </IOSGroupedList>

        {/* Surveyor Profile Group */}
        <IOSGroupedList
          header={t('settings.profile_header')}
          footer={t('settings.profile_footer')}
        >
          <IOSListRow
            title={t('settings.observer_name')}
            icon="person"
            iconColor={IOSColors.systemBlue}
            value={userAccount?.name || 'Dr. Amira Ben Salem'}
          />
          <IOSListRow
            title={t('settings.institution')}
            icon="shield"
            iconColor={IOSColors.systemGreen}
            value={userAccount?.organization || 'Institut Pasteur'}
          />
          <IOSListRow
            title={t('settings.observer_id')}
            icon="info"
            iconColor={IOSColors.systemGray}
            value={userAccount?.surveyorId || 'TUN-OBS-2026-042'}
            isLast={!userAccount?.governorate && !userAccount?.role}
          />
          {userAccount?.governorate ? (
            <IOSListRow
              title="Governorate / Sector"
              icon="location"
              iconColor={IOSColors.systemTeal}
              value={userAccount.governorate}
              isLast={!userAccount?.role}
            />
          ) : null}
          {userAccount?.role ? (
            <IOSListRow
              title="Official Role"
              icon="star"
              iconColor={IOSColors.systemYellow}
              value={userAccount.role.toUpperCase()}
              isLast
            />
          ) : null}
        </IOSGroupedList>

        {/* Database Sync & Offline Storage Group */}
        <IOSGroupedList
          header={t('settings.database_header')}
          footer="All survey sessions and photos are saved to local SQLite tables before cloud upload."
        >
          <IOSListRow
            title={t('settings.sync_status')}
            subtitle={`Last sync: ${lastSyncedAt || 'Never'} • ${pendingCount} in outbox`}
            icon="compass"
            iconColor={IOSColors.systemTeal}
            value={isSyncing ? 'Syncing...' : pendingCount === 0 ? 'Up to Date' : `${pendingCount} Queued`}
            rightComponent={
              <TouchableOpacity
                onPress={handleTriggerSync}
                style={[styles.syncButton, isSyncing && styles.syncButtonActive]}
                disabled={isSyncing}
              >
                <Text style={styles.syncButtonText}>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>
            }
          />
          <IOSListRow
            title="Local SQLite Cache"
            subtitle="4 Observations • 1 Track • 3 Photos"
            icon="list"
            iconColor={IOSColors.systemIndigo}
            value="2.4 MB"
          />
          <IOSListRow
            title={t('settings.export_dwca')}
            subtitle="Darwin Core occurrence.csv & meta.xml"
            icon="squareStack"
            iconColor={IOSColors.systemBlue}
            showDisclosure
            onPress={handleExportDwCA}
          />
          <IOSListRow
            title={t('settings.export_secr')}
            subtitle="R secr::read.traps & Distance::ds"
            icon="chart"
            iconColor={IOSColors.systemOrange}
            showDisclosure
            isLast
            onPress={handleExportSECR}
          />
        </IOSGroupedList>

        {/* Standards & Guidelines Info */}
        <IOSGroupedList header={t('settings.about_header')}>
          <IOSListRow
            title={t('settings.about_icam')}
            subtitle="Standardized protocols for roaming animals"
            icon="paw"
            iconColor={IOSColors.systemTeal}
            showDisclosure
          />
          <IOSListRow
            title={t('settings.about_distance')}
            subtitle="Perpendicular distance detection functions"
            icon="ruler"
            iconColor={IOSColors.systemGreen}
            showDisclosure
          />
          <IOSListRow
            title={t('settings.about_who')}
            subtitle="Rabies epidemiology & vaccination coverage"
            icon="shield"
            iconColor={IOSColors.systemRed}
            showDisclosure
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
  scrollContent: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  syncButton: {
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  syncButtonActive: {
    backgroundColor: 'rgba(48, 176, 199, 0.3)',
  },
  syncButtonText: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
});
