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
import { IOSColors, IOSTypography } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSGroupedList,
  IOSListRow,
  IOSIcon,
  IOSButton,
} from '../components/ios';
import { setAppLanguage } from '../i18n';
import { useSyncStore } from '../features/sync/syncStore';
import { useThemeStore } from '../features/theme/themeStore';
import { SightingItem } from './SightingsScreen';
import { UserAccount } from './AccountScreen';
import { deleteMyAccount, exportMyData } from '../services/supabase';

const csvField = (value: string) => `"${value.replace(/"/g, '""')}"`;

interface SettingsScreenProps {
  onLanguageChange?: (lng: 'ar' | 'fr' | 'en') => void;
  onBack?: () => void;
  sightings?: SightingItem[];
  userAccount?: UserAccount | null;
  onAccountDeleted?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onLanguageChange,
  onBack,
  sightings = [],
  userAccount,
  onAccountDeleted,
}) => {
  const { t, i18n } = useTranslation();
  const { isSyncing, lastSyncedAt, pendingCount, triggerSync } = useSyncStore();
  const { themeMode, colors, toggleTheme } = useThemeStore();

  const [exactCoordsEnabled, setExactCoordsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentLang = i18n.language || 'en';

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
        t('ui_settings.cloud_synchronization'),
        res.success
          ? t('ui_settings.synced_records', { count: res.syncedCount })
          : t('ui_settings.sync_completed_remaining_records_held_safely')
      );
    } catch (err: any) {
      Alert.alert(
        t('ui_settings.sync_offline'),
        err?.message || t('ui_settings.database_gateway_temporarily_unavailable')
      );
    }
  };

  const handleExportDwCA = async () => {
    setIsExporting(true);
    try {
      const records = sightings.map((s, idx) => {
        const lat = exactCoordsEnabled
          ? s.latitude.toFixed(6)
          : (Math.round(s.latitude * 100) / 100).toFixed(4);
        const lon = exactCoordsEnabled
          ? s.longitude.toFixed(6)
          : (Math.round(s.longitude * 100) / 100).toFixed(4);
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
          // Country is resolved server-side; the device does not guess it
          '',
          csvField(userAccount?.organization || ''),
        ].join(',');
      });

      const header =
        'occurrenceID,basisOfRecord,scientificName,vernacularName,individualCount,eventDate,decimalLatitude,decimalLongitude,geodeticDatum,coordinateUncertaintyInMeters,countryCode,institutionCode';
      const csv = `${header}\n${records.join('\n')}`;

      await Share.share({
        title: t('ui_settings.hawem_darwin_core_archive_dwc_a'),
        message: csv,
      });
    } catch (e) {
      console.warn('Share error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportMyData = async () => {
    setIsExporting(true);
    try {
      const res = await exportMyData();
      if (!res.success) {
        Alert.alert(t('privacy.export_failed'), res.error);
        return;
      }
      await Share.share({
        title: t('privacy.export_title'),
        message: JSON.stringify(res.data, null, 2),
      });
    } catch (e) {
      console.warn('Personal data export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(t('privacy.delete_confirm_title'), t('privacy.delete_confirm_body'), [
      { text: t('privacy.cancel'), style: 'cancel' },
      {
        text: t('privacy.delete_confirm_action'),
        style: 'destructive',
        onPress: async () => {
          setIsDeleting(true);
          const res = await deleteMyAccount();
          setIsDeleting(false);
          if (!res.success) {
            Alert.alert(t('privacy.delete_failed'), res.error);
            return;
          }
          Alert.alert(t('privacy.delete_done_title'), t('privacy.delete_done_body'));
          onAccountDeleted?.();
        },
      },
    ]);
  };

  const handleExportSECR = async () => {
    setIsExporting(true);
    try {
      const rows = sightings.map((s) =>
        [
          s.id,
          s.species,
          s.observed_at.slice(0, 10),
          s.distance_from_path_m !== undefined ? s.distance_from_path_m.toFixed(1) : '5.0',
          s.latitude.toFixed(6),
          s.longitude.toFixed(6),
          s.body_condition_score || 3,
        ].join(',')
      );

      const header =
        'session_id,species,date,perpendicular_distance_m,animal_lat,animal_lon,body_condition_score';
      const csv = `${header}\n${rows.join('\n')}`;

      await Share.share({
        title: t('ui_settings.hawem_secr_distance_sampling_matrix'),
        message: csv,
      });
    } catch (e) {
      console.warn('SECR Export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.screenBg }]}
      edges={['top', 'left', 'right']}
    >
      <IOSNavigationBar title={t('settings.title')} onBack={onBack} backTitle={t('nav.home')} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Visual Appearance & Theme Group */}
        <IOSGroupedList
          header={t('ui_settings.appearance_visuals')}
          footer={t('ui_settings.switch_between_soft_porcelain_daylight_palette')}
        >
          <IOSListRow
            title={
              themeMode === 'night'
                ? t('ui_settings.night_mode_nocturnal')
                : t('ui_settings.day_mode_standard')
            }
            subtitle={
              themeMode === 'night'
                ? t('ui_settings.dark_high_contrast_palette_for_evening')
                : t('ui_settings.porcelain_daylight_palette')
            }
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
            title={t('ui_settings.english')}
            subtitle={t('ui_settings.default_language')}
            icon="globe"
            iconColor={IOSColors.systemBlue}
            rightComponent={
              currentLang === 'en' ? (
                <IOSIcon name="check" size={18} color={IOSColors.systemTeal} />
              ) : null
            }
            onPress={() => handleSelectLanguage('en')}
            isLast
          />
        </IOSGroupedList>

        {/* Georeferencing & Spatial Precision Group */}
        <IOSGroupedList
          header={t('settings.georeferencing_header')}
          footer={t('settings.georeferencing_footer')}
        >
          <IOSListRow
            title={t('ui_settings.precision_coordinates_title')}
            subtitle={t('ui_settings.precision_coordinates_sub')}
            icon="map"
            iconColor={IOSColors.systemPurple}
            value={t('ui_settings.precision_coordinates_value')}
          />
          <IOSListRow
            title={t('ui_settings.precision_gps_title')}
            subtitle={t('ui_settings.precision_gps_sub')}
            icon="ruler"
            iconColor={IOSColors.systemOrange}
            value={t('ui_settings.precision_gps_value')}
          />
          <IOSListRow
            title={t('ui_settings.precision_public_title')}
            subtitle={t('ui_settings.precision_public_sub')}
            icon="squareStack"
            iconColor={IOSColors.systemGreen}
            value={t('ui_settings.precision_public_value')}
          />
          <IOSListRow
            title={t('ui_settings.precision_export_title')}
            subtitle={t('ui_settings.precision_export_sub')}
            icon="location"
            iconColor={IOSColors.systemTeal}
            isLast
            rightComponent={
              <Switch
                value={exactCoordsEnabled}
                onValueChange={setExactCoordsEnabled}
                trackColor={{ false: IOSColors.systemGray5, true: IOSColors.systemTeal }}
              />
            }
          />
        </IOSGroupedList>

        {/* Surveyor Profile Group */}
        <IOSGroupedList header={t('settings.profile_header')} footer={t('settings.profile_footer')}>
          <IOSListRow
            title={t('settings.observer_name')}
            icon="person"
            iconColor={IOSColors.systemBlue}
            value={userAccount?.name || t('ui_settings.field_surveyor')}
          />
          <IOSListRow
            title={t('settings.institution')}
            icon="shield"
            iconColor={IOSColors.systemGreen}
            value={userAccount?.organization || t('ui_settings.institut_pasteur')}
          />
          <IOSListRow
            title={t('settings.observer_id')}
            icon="info"
            iconColor={IOSColors.systemGray}
            value={userAccount?.surveyorId || t('ui_common.not_set')}
            isLast={!userAccount?.governorate && !userAccount?.role}
          />
          {userAccount?.governorate ? (
            <IOSListRow
              title={t('ui_settings.governorate_sector')}
              icon="location"
              iconColor={IOSColors.systemTeal}
              value={userAccount.governorate}
              isLast={!userAccount?.role}
            />
          ) : null}
          {userAccount?.role ? (
            <IOSListRow
              title={t('ui_settings.official_role')}
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
          footer={t('ui_settings.all_survey_sessions_and_photos_are')}
        >
          <IOSListRow
            title={t('settings.sync_status')}
            subtitle={t('ui_settings.last_sync_in_outbox', {
              v0: lastSyncedAt || t('ui_settings.never'),
              pendingCount,
            })}
            icon="compass"
            iconColor={IOSColors.systemTeal}
            value={
              isSyncing
                ? t('ui_settings.syncing')
                : pendingCount === 0
                  ? t('ui_settings.up_to_date')
                  : t('ui_settings.queued', { pendingCount })
            }
            rightComponent={
              <TouchableOpacity
                onPress={handleTriggerSync}
                style={[styles.syncButton, isSyncing && styles.syncButtonActive]}
                disabled={isSyncing}
              >
                <Text style={styles.syncButtonText}>
                  {isSyncing ? t('ui_settings.syncing') : t('ui_settings.sync_now')}
                </Text>
              </TouchableOpacity>
            }
          />
          <IOSListRow
            title={t('ui_settings.local_sqlite_cache')}
            subtitle={t('ui_settings.4_observations_1_track_3_photos')}
            icon="list"
            iconColor={IOSColors.systemIndigo}
            value={t('ui_settings.2_4_mb')}
          />
          <IOSListRow
            title={t('settings.export_dwca')}
            subtitle={t('ui_settings.darwin_core_occurrence_csv_meta_xml')}
            icon="squareStack"
            iconColor={IOSColors.systemBlue}
            showDisclosure
            onPress={handleExportDwCA}
          />
          <IOSListRow
            title={t('settings.export_secr')}
            subtitle={t('ui_settings.r_secr_read_traps_distance_ds')}
            icon="chart"
            iconColor={IOSColors.systemOrange}
            showDisclosure
            isLast
            onPress={handleExportSECR}
          />
        </IOSGroupedList>

        {/* Personal data: right of access and right to erasure */}
        {userAccount ? (
          <IOSGroupedList header={t('privacy.header')} footer={t('privacy.footer')}>
            <IOSListRow
              title={t('privacy.export_title')}
              subtitle={t('privacy.export_sub')}
              icon="document"
              iconColor={IOSColors.systemBlue}
              showDisclosure
              onPress={isExporting ? undefined : handleExportMyData}
            />
            <IOSListRow
              title={isDeleting ? t('privacy.deleting') : t('privacy.delete_title')}
              subtitle={t('privacy.delete_sub')}
              icon="trash"
              iconColor={IOSColors.systemRed}
              isLast
              onPress={isDeleting ? undefined : handleDeleteAccount}
            />
          </IOSGroupedList>
        ) : null}

        {/* Standards & Guidelines Info */}
        <IOSGroupedList header={t('settings.about_header')}>
          <IOSListRow
            title={t('settings.about_icam')}
            subtitle={t('ui_settings.standardized_protocols_for_roaming_animals')}
            icon="paw"
            iconColor={IOSColors.systemTeal}
            showDisclosure
          />
          <IOSListRow
            title={t('settings.about_distance')}
            subtitle={t('ui_settings.perpendicular_distance_detection_functions')}
            icon="ruler"
            iconColor={IOSColors.systemGreen}
            showDisclosure
          />
          <IOSListRow
            title={t('settings.about_who')}
            subtitle={t('ui_settings.rabies_epidemiology_vaccination_coverage')}
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
