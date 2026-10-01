/**
 * Settings (v3): upload status, appearance, language, how locations are
 * handled, and the volunteer's own data. Research exports (Darwin Core, SECR)
 * are built from server data in the research portal, not on the phone, so the
 * phone never ships a file with filled-in defaults.
 */

import React, { useState } from 'react';
import { Alert, Share } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Row, Screen, Section, Symbol, useTheme } from '../ui';
import { useSyncStore } from '../features/sync/syncStore';
import { useThemeStore } from '../features/theme/themeStore';
import { deleteMyAccount, exportMyData } from '../services/supabase';
import { setAppLanguage } from '../i18n';
import languages from '../i18n/languages.json';
import { formatObservedAt } from '../utils/formatObservation';

const LANGUAGE_NAMES: Record<string, string> = { en: 'English', fr: 'Français', ar: 'العربية' };

export function SettingsView({
  onBack,
  onLanguageChange,
  onAccountDeleted,
}: {
  onBack: () => void;
  onLanguageChange?: (lng: 'ar' | 'fr' | 'en') => void;
  onAccountDeleted: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { c, dark } = useTheme();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { isSyncing, lastSyncedAt, pendingCount, triggerSync, wifiOnly, setWifiOnly } =
    useSyncStore();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const lastSync = lastSyncedAt
    ? formatObservedAt(lastSyncedAt, {
        today: t('ui_common.today'),
        yesterday: t('ui_common.yesterday'),
      })
    : t('ui_settings.never');

  const syncNow = async () => {
    const res = await triggerSync();
    if (!res.success)
      Alert.alert(t('ui_settings_v3.upload_failed_title'), t('ui_settings_v3.upload_failed_body'));
  };

  const exportData = async () => {
    setExporting(true);
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
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = () =>
    Alert.alert(t('privacy.delete_confirm_title'), t('privacy.delete_confirm_body'), [
      { text: t('privacy.cancel'), style: 'cancel' },
      {
        text: t('privacy.delete_confirm_action'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const res = await deleteMyAccount();
          setDeleting(false);
          if (!res.success) {
            Alert.alert(t('privacy.delete_failed'), res.error);
            return;
          }
          Alert.alert(t('privacy.delete_done_title'), t('privacy.delete_done_body'));
          onAccountDeleted();
        },
      },
    ]);

  const current = (i18n.language || 'en').slice(0, 2);
  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen title={t('settings.title')} onBack={onBack} inTabs={false}>
      <Section header={t('ui_settings_v3.upload')} footer={t('ui_settings_v3.upload_footer')}>
        <Row
          icon="upload"
          iconColor={pendingCount > 0 ? c.warning : undefined}
          title={
            pendingCount > 0
              ? t('ui_sightings_v3.waiting', { count: pendingCount })
              : t('ui_settings_v3.up_to_date')
          }
          subtitle={t('ui_settings_v3.last_upload', { when: lastSync })}
        />
        <Row
          icon="sync"
          title={isSyncing ? t('ui_settings.syncing') : t('ui_settings_v3.upload_now')}
          onPress={isSyncing ? undefined : syncNow}
          chevron={false}
        />
        <Row
          icon="globe"
          title={t('ui_settings_v3.wifi_only')}
          subtitle={t('ui_settings_v3.wifi_only_sub')}
          toggle={{ value: wifiOnly, onChange: setWifiOnly }}
        />
      </Section>

      <Section header={t('ui_settings_v3.appearance')}>
        <Row
          icon={dark ? 'moon' : 'sun'}
          title={t('ui_profile.dark_mode')}
          toggle={{ value: dark, onChange: () => toggleTheme() }}
        />
      </Section>

      <Section
        header={t('settings.language_header')}
        footer={languages.enabled.length < 3 ? t('ui_settings_v3.language_footer') : undefined}
      >
        {languages.enabled.map((lng) => (
          <Row
            key={lng}
            icon="globe"
            title={LANGUAGE_NAMES[lng] ?? lng}
            chevron={false}
            trailing={
              current === lng ? (
                <Symbol name="check" size={18} color={c.accent} weight="semibold" />
              ) : undefined
            }
            onPress={() => {
              setAppLanguage(lng as 'ar' | 'fr' | 'en');
              onLanguageChange?.(lng as 'ar' | 'fr' | 'en');
            }}
          />
        ))}
      </Section>

      <Section header={t('ui_settings_v3.locations')}>
        <Row
          icon="pin"
          title={t('ui_settings.precision_coordinates_title')}
          subtitle={t('ui_settings.precision_coordinates_sub')}
          detail={t('ui_settings.precision_coordinates_value')}
        />
        <Row
          icon="locate"
          title={t('ui_settings.precision_gps_title')}
          subtitle={t('ui_settings.precision_gps_sub')}
          detail={t('ui_settings.precision_gps_value')}
        />
        <Row
          icon="shield"
          title={t('ui_settings.precision_public_title')}
          subtitle={t('ui_settings.precision_public_sub')}
          detail={t('ui_settings.precision_public_value')}
        />
      </Section>

      <Section header={t('privacy.header')} footer={t('privacy.footer')}>
        <Row
          icon="share"
          title={exporting ? t('ui_settings_v3.preparing') : t('privacy.export_title')}
          subtitle={t('privacy.export_sub')}
          onPress={exporting ? undefined : exportData}
        />
        <Row
          icon="trash"
          destructive
          title={deleting ? t('privacy.deleting') : t('privacy.delete_title')}
          subtitle={t('privacy.delete_sub')}
          onPress={deleting ? undefined : deleteAccount}
        />
      </Section>

      <Section header={t('ui_settings_v3.about')} footer={t('ui_settings_v3.research_exports')}>
        <Row icon="info" title={t('ui_settings_v3.version')} detail={version} />
      </Section>
    </Screen>
  );
}
