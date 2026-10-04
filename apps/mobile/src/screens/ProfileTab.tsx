/**
 * Profile tab (v3): who you are, your level at a glance, and the way to
 * training and settings. Organisation and region are optional and only what
 * the volunteer types; the app never fills them in for anyone.
 */

import { formatNumber } from '../utils/formatObservation';
import React, { useState } from 'react';
import { Alert, Image, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Button,
  Card,
  Glass,
  Gradient,
  Press,
  ProgressRing,
  Row,
  Screen,
  Section,
  Segmented,
  Symbol,
  Text,
  useTheme,
  type SymbolName,
} from '../ui';
import type { UserAccount } from '../app-state/types';
import { useThemeStore } from '../features/theme/themeStore';
import { levelProgress, weeklyStreak } from '../features/gamification/progress';
import { useMySessions, useMyStats } from '../features/gamification/useProgressData';

export function ProfileTab({
  userAccount,
  authEmail,
  onSave,
  onSignOut,
  onOpenTraining,
  onOpenSettings,
  onOpenProgress,
}: {
  userAccount: UserAccount | null;
  authEmail?: string;
  onSave: (a: UserAccount) => void;
  onSignOut: () => void;
  onOpenTraining: () => void;
  onOpenSettings: () => void;
  onOpenProgress: () => void;
}) {
  const { t } = useTranslation();
  const { c, dark, g } = useTheme();
  const insets = useSafeAreaInsets();
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const [editing, setEditing] = useState(false);
  const stats = useMyStats();
  const sessions = useMySessions();
  const lv = levelProgress(stats.data?.xp ?? 0);
  const streak = weeklyStreak(sessions.data ?? []);

  if (editing || !userAccount) {
    return (
      <ProfileForm
        key={userAccount?.surveyorId ?? 'new'}
        account={userAccount}
        authEmail={authEmail}
        onCancel={userAccount ? () => setEditing(false) : undefined}
        onSave={(a) => {
          onSave(a);
          setEditing(false);
        }}
      />
    );
  }

  const info = (icon: SymbolName, label: string, value?: string) =>
    value ? (
      <View
        key={label}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 }}
      >
        <Symbol name={icon} size={20} color={c.ink2} />
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="ink3">
            {label}
          </Text>
          <Text variant="body" numberOfLines={2}>
            {value}
          </Text>
        </View>
      </View>
    ) : null;

  return (
    <Screen
      title={t('ui_tabs.profile')}
      header={
        <Gradient
          colors={g.hero}
          style={{
            marginTop: -(insets.top + 12),
            marginHorizontal: -20,
            paddingTop: insets.top + 16,
            paddingBottom: 64,
            alignItems: 'center',
            gap: 8,
            borderBottomLeftRadius: 32,
            borderBottomRightRadius: 32,
          }}
        >
          <Text
            variant="headline"
            style={{ color: '#FFFFFF', marginBottom: 8 }}
            accessibilityRole="header"
          >
            {t('ui_tabs.profile')}
          </Text>
          <View style={{ borderRadius: 60, borderWidth: 4, borderColor: 'rgba(255,255,255,0.6)' }}>
            <Avatar account={userAccount} size={104} />
            <Press
              onPress={() => setEditing(true)}
              accessibilityLabel={t('ui_profile.edit_title')}
              style={{
                position: 'absolute',
                end: -6,
                bottom: -6,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: c.lime,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Symbol name="edit" size={17} color={c.onLime} weight="semibold" />
            </Press>
          </View>
          <Text variant="title2" align="center" style={{ marginTop: 6, color: '#FFFFFF' }}>
            {userAccount.name}
          </Text>
          <Glass
            tone="onColor"
            style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}
          >
            <Text variant="footnote" weight="600" style={{ color: '#FFFFFF' }}>
              {t(`ui_profile.role_${userAccount.role}`)}
            </Text>
          </Glass>
        </Gradient>
      }
    >
      <Card style={{ marginTop: -44, marginBottom: 20, paddingVertical: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Text variant="title3" style={{ flex: 1 }} accessibilityRole="header">
            {t('ui_profile.personal_info')}
          </Text>
          <Button
            kind="plain"
            size="small"
            title={t('common.edit')}
            onPress={() => setEditing(true)}
          />
        </View>
        {info('profile', t('ui_profile.name'), userAccount.name)}
        {info('mail', t('ui_profile.email'), authEmail || userAccount.email)}
        {info('building', t('ui_profile.organization'), userAccount.organization?.trim())}
        {info('pin', t('ui_profile.region'), userAccount.governorate?.trim())}
        {info('shield', t('ui_profile.observer_id_label'), userAccount.surveyorId)}
      </Card>

      <Press
        onPress={onOpenProgress}
        accessibilityLabel={t('ui_profile.progress_a11y', {
          level: lv.level,
          xp: stats.data?.xp ?? 0,
          weeks: streak.weeks,
        })}
        style={{ marginBottom: 28 }}
      >
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProgressRing value={lv.fraction} size={56} stroke={6}>
            <Text variant="headline" tabular>
              {lv.level}
            </Text>
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <Text variant="headline">{t(lv.rankKey)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 }}>
              <Text variant="footnote" tone="ink2" tabular>
                {t('ui_progress_v3.xp_total', { xp: formatNumber(stats.data?.xp ?? 0) })}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Symbol
                  name="flame"
                  size={14}
                  color={streak.weeks > 0 ? c.warning : c.ink3}
                  weight="semibold"
                />
                <Text variant="footnote" tone="ink2" tabular>
                  {t('ui_profile.weeks', { count: streak.weeks })}
                </Text>
              </View>
            </View>
          </View>
          <Symbol name="chevronRight" size={14} color={c.ink3} weight="semibold" />
        </Card>
      </Press>

      <Section>
        <Row
          icon="academy"
          title={t('ui_profile.training')}
          subtitle={t('ui_profile.training_sub')}
          onPress={onOpenTraining}
        />
        <Row
          icon="settings"
          title={t('settings.title')}
          subtitle={t('ui_profile.settings_sub')}
          onPress={onOpenSettings}
        />
        <Row
          icon={dark ? 'moon' : 'sun'}
          title={t('ui_profile.dark_mode')}
          toggle={{ value: dark, onChange: () => toggleTheme() }}
        />
      </Section>

      <Section footer={authEmail ? t('ui_profile.signed_in_as', { email: authEmail }) : undefined}>
        <Row
          title={t('ui_profile.sign_out')}
          destructive
          onPress={() =>
            Alert.alert(t('ui_profile.sign_out_title'), t('ui_profile.sign_out_body'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('ui_profile.sign_out'), style: 'destructive', onPress: onSignOut },
            ])
          }
        />
      </Section>
    </Screen>
  );
}

export function Avatar({
  account,
  size,
}: {
  account: Pick<UserAccount, 'name' | 'avatarUri'>;
  size: number;
}) {
  const { c } = useTheme();
  const initials =
    account.name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  if (account.avatarUri) {
    return (
      <Image
        source={{ uri: account.avatarUri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.fill }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        variant="title1"
        tone="accent"
        style={{ fontSize: size * 0.36, lineHeight: size * 0.44 }}
      >
        {initials}
      </Text>
    </View>
  );
}

function ProfileForm({
  account,
  authEmail,
  onCancel,
  onSave,
}: {
  account: UserAccount | null;
  authEmail?: string;
  onCancel?: () => void;
  onSave: (a: UserAccount) => void;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const [name, setName] = useState(account?.name ?? '');
  const [organization, setOrganization] = useState(account?.organization ?? '');
  const [region, setRegion] = useState(account?.governorate ?? '');
  const [role, setRole] = useState<UserAccount['role']>(account?.role ?? 'volunteer');
  const [avatarUri, setAvatarUri] = useState(account?.avatarUri);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!res.canceled && res.assets?.[0]) setAvatarUri(res.assets[0].uri);
  };

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('ui_profile.name_required_title'), t('ui_profile.name_required_body'));
      return;
    }
    onSave({
      name: name.trim(),
      email: account?.email || authEmail || '',
      organization: organization.trim(),
      role,
      governorate: region.trim(),
      surveyorId: account?.surveyorId ?? '',
      avatarUri,
      createdAt: account?.createdAt ?? new Date().toISOString(),
    });
  };

  const input = {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 17,
    color: c.ink,
  } as const;
  const field = (label: string, hint: string | undefined, el: React.ReactNode) => (
    <View style={{ gap: 6, marginBottom: 20 }}>
      <Text variant="subhead" weight="600">
        {label}
      </Text>
      {el}
      {hint ? (
        <Text variant="footnote" tone="ink2">
          {hint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen
      title={account ? t('ui_profile.edit_title') : t('ui_profile.create_title')}
      subtitle={account ? undefined : t('ui_profile.create_sub')}
      accessory={
        onCancel ? (
          <Button kind="plain" size="small" title={t('common.cancel')} onPress={onCancel} />
        ) : undefined
      }
    >
      <Press
        onPress={pickPhoto}
        accessibilityLabel={t('ui_profile.change_photo')}
        style={{ alignSelf: 'center', alignItems: 'center', gap: 8, marginBottom: 24 }}
      >
        <Avatar account={{ name: name || '?', avatarUri }} size={88} />
        <Text variant="subhead" tone="accent" weight="600">
          {avatarUri ? t('ui_profile.change_photo') : t('ui_profile.add_photo')}
        </Text>
      </Press>

      {field(
        t('ui_profile.name'),
        t('ui_profile.name_hint'),
        <TextInput
          value={name}
          onChangeText={setName}
          style={input}
          placeholder={t('ui_profile.name_placeholder')}
          placeholderTextColor={c.ink3}
          autoComplete="name"
          textContentType="name"
          accessibilityLabel={t('ui_profile.name')}
          maxLength={60}
        />
      )}
      {field(
        t('ui_profile.role'),
        undefined,
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: 'volunteer', label: t('ui_profile.role_volunteer') },
            { value: 'surveyor', label: t('ui_profile.role_surveyor') },
            { value: 'researcher', label: t('ui_profile.role_researcher') },
          ]}
        />
      )}
      {field(
        t('ui_profile.organization'),
        t('ui_profile.optional'),
        <TextInput
          value={organization}
          onChangeText={setOrganization}
          style={input}
          placeholder={t('ui_profile.organization_placeholder')}
          placeholderTextColor={c.ink3}
          accessibilityLabel={t('ui_profile.organization')}
          maxLength={80}
        />
      )}
      {field(
        t('ui_profile.region'),
        t('ui_profile.region_hint'),
        <TextInput
          value={region}
          onChangeText={setRegion}
          style={input}
          placeholder={t('ui_profile.region_placeholder')}
          placeholderTextColor={c.ink3}
          accessibilityLabel={t('ui_profile.region')}
          maxLength={60}
        />
      )}
      <Button
        title={account ? t('common.save') : t('ui_profile.create')}
        onPress={save}
        style={{ marginTop: 8 }}
      />
    </Screen>
  );
}
