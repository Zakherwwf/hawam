import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  Switch,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { IOSColors, IOSTypography, IOSLayout } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSGroupedList,
  IOSListRow,
  IOSButton,
  IOSIcon,
  IOSSegmentedControl,
} from '../components/ios';
import { SightingItem } from './SightingsScreen';
import { supabase } from '../services/supabase';
import { useThemeStore } from '../features/theme/themeStore';
import { capturePhotoFromCamera, pickPhotoFromLibrary } from '../services/cameraService';
import type { Session } from '@supabase/supabase-js';

export interface UserAccount {
  name: string;
  email: string;
  organization: string;
  role: 'surveyor' | 'volunteer' | 'researcher';
  governorate: string;
  surveyorId: string;
  avatarUri?: string;
  createdAt: string;
}

interface AccountScreenProps {
  userAccount: UserAccount | null;
  onSaveAccount: (account: UserAccount) => void;
  onSignOut?: () => void;
  onOpenTraining?: () => void;
  onOpenSettings?: () => void;
  sightings?: SightingItem[];
  stats: {
    sessionsCompleted: number;
    kmWalked: number;
    animalsRecorded: number;
  };
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  userAccount,
  onSaveAccount,
  onSignOut,
  onOpenTraining,
  onOpenSettings,
  sightings = [],
  stats,
}) => {
  const { t, i18n } = useTranslation();
  const { themeMode, colors, toggleTheme } = useThemeStore();

  // Registration form state
  const [isEditing, setIsEditing] = useState<boolean>(!userAccount);
  const [name, setName] = useState<string>(userAccount?.name || '');
  const [email, setEmail] = useState<string>(userAccount?.email || '');
  const [organization, setOrganization] = useState<string>(
    userAccount?.organization || 'Institut Pasteur de Tunis'
  );
  const [role, setRole] = useState<'surveyor' | 'volunteer' | 'researcher'>(
    userAccount?.role || 'surveyor'
  );
  const [governorate, setGovernorate] = useState<string>(userAccount?.governorate || 'Tunis');
  const [surveyorId, setSurveyorId] = useState<string>(userAccount?.surveyorId || '');
  const [avatarUri, setAvatarUri] = useState<string | undefined>(userAccount?.avatarUri);
  // Supabase Auth Session (for profile ID / email fallback)
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user?.email) {
        setEmail(currentSession.user.email);
        if (!name && currentSession.user.user_metadata?.name) {
          setName(currentSession.user.user_metadata.name);
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user?.email) {
        setEmail(currentSession.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (userAccount) {
      setName(userAccount.name || '');
      setEmail(userAccount.email || '');
      setOrganization(userAccount.organization || '');
      setRole(userAccount.role || 'surveyor');
      setGovernorate(userAccount.governorate || 'Tunis');
      setSurveyorId(userAccount.surveyorId || '');
      setAvatarUri(userAccount.avatarUri);
    }
  }, [userAccount]);

  const handlePickAvatar = () => {
    const options = ['Cancel', 'Take Photo with Camera', 'Choose from Photo Library'];
    const currentAvatar = avatarUri || userAccount?.avatarUri;
    if (currentAvatar) {
      options.push('Remove Photo');
    }

    const onSelectPhoto = (uri?: string) => {
      setAvatarUri(uri);
      if (userAccount && !isEditing) {
        onSaveAccount({
          ...userAccount,
          avatarUri: uri,
        });
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('ui_account.profile_picture'),
          message: t('ui_account.select_an_official_surveyor_photo_or_2'),
          options,
          cancelButtonIndex: 0,
          destructiveButtonIndex: currentAvatar ? 3 : undefined,
        },
        async (idx) => {
          if (idx === 1) {
            const photo = await capturePhotoFromCamera();
            if (photo?.uri) onSelectPhoto(photo.uri);
          } else if (idx === 2) {
            const photo = await pickPhotoFromLibrary();
            if (photo?.uri) onSelectPhoto(photo.uri);
          } else if (idx === 3) {
            onSelectPhoto(undefined);
          }
        }
      );
    } else {
      const buttons: any[] = [
        { text: t('ui_account.cancel'), style: 'cancel' },
        {
          text: t('ui_account.camera'),
          onPress: async () => {
            const photo = await capturePhotoFromCamera();
            if (photo?.uri) onSelectPhoto(photo.uri);
          },
        },
        {
          text: t('ui_account.gallery'),
          onPress: async () => {
            const photo = await pickPhotoFromLibrary();
            if (photo?.uri) onSelectPhoto(photo.uri);
          },
        },
      ];
      if (currentAvatar) {
        buttons.push({
          text: t('ui_account.remove_photo'),
          style: 'destructive',
          onPress: () => onSelectPhoto(undefined),
        });
      }
      Alert.alert(
        t('ui_account.profile_picture'),
        t('ui_account.select_an_official_surveyor_photo_or'),
        buttons
      );
    }
  };

  const handleCreateOrUpdate = () => {
    if (!name.trim()) {
      Alert.alert(t('ui_account.required_field'), t('ui_account.please_enter_your_full_name_to'));
      return;
    }

    const effectiveId =
      surveyorId.trim() ||
      userAccount?.surveyorId ||
      (session?.user?.id
        ? `TUN-OBS-${session.user.id.slice(0, 6).toUpperCase()}`
        : `TUN-OBS-${Math.floor(1000 + Math.random() * 9000)}`);

    const account: UserAccount = {
      name: name.trim(),
      email: email.trim() || session?.user?.email || 'surveyor@pasteur.tn',
      organization: organization.trim() || 'Institut Pasteur de Tunis',
      role,
      governorate,
      surveyorId: effectiveId,
      avatarUri,
      createdAt: userAccount?.createdAt || new Date().toISOString(),
    };

    onSaveAccount(account);
    setIsEditing(false);
  };

  const TUNISIA_GOVERNORATES = [
    'Tunis',
    'Ariana',
    'Ben Arous',
    'Manouba',
    'Nabeul',
    'Sousse',
    'Monastir',
    'Mahdia',
    'Sfax',
    'Bizerte',
    'Kairouan',
    'Gabes',
    'Medenine',
    'Tozeur',
  ];

  // If user is creating their first account
  if (isEditing || !userAccount) {
    const editInitials = (name || userAccount?.name || 'Surveyor')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    return (
      <View style={[styles.outerContainer, { backgroundColor: colors.screenBg }]}>
        <LinearGradient
          colors={colors.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <IOSNavigationBar
            title={userAccount ? t('ui_account.edit_profile') : t('ui_account.create_account')}
            onBack={userAccount ? () => setIsEditing(false) : undefined}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar Picker Header */}
            <View style={styles.editAvatarSection}>
              <TouchableOpacity
                style={styles.editAvatarTouch}
                onPress={handlePickAvatar}
                activeOpacity={0.8}
              >
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.editAvatarImage} />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Text style={styles.editAvatarInitials}>{editInitials}</Text>
                  </View>
                )}
                <View style={styles.editAvatarCameraBadge}>
                  <IOSIcon name="camera" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickAvatar} style={styles.changePhotoBtn}>
                <Text style={styles.changePhotoText}>
                  {avatarUri
                    ? t('ui_account.change_profile_picture')
                    : t('ui_account.add_profile_picture')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Form Group */}
            <IOSGroupedList header={t('ui_account.surveyor_details')}>
              <View style={styles.formRow}>
                <Text style={styles.inputLabel}>{t('ui_account.full_name')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('ui_account.e_g_sami_trabelsi')}
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  autoCapitalize="words"
                />
              </View>

              <View style={[styles.formRow, styles.topBorder]}>
                <Text style={styles.inputLabel}>{t('ui_account.email_address')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('ui_common.email_placeholder')}
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={[styles.formRow, styles.topBorder]}>
                <Text style={styles.inputLabel}>{t('ui_account.surveyor_id_call_sign')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={surveyorId}
                  onChangeText={setSurveyorId}
                  placeholder={t('ui_account.e_g_tun_obs_21_or')}
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  autoCapitalize="characters"
                />
              </View>

              <View style={[styles.formRow, styles.topBorder]}>
                <Text style={styles.inputLabel}>{t('ui_account.organization_entity')}</Text>
                <TextInput
                  style={styles.textInput}
                  value={organization}
                  onChangeText={setOrganization}
                  placeholder={t('ui_account.e_g_institut_pasteur_de_tunis')}
                  placeholderTextColor={IOSColors.tertiaryLabel}
                />
              </View>
            </IOSGroupedList>

            {/* Operating Governorate */}
            <IOSGroupedList header={t('ui_account.operating_governorate')}>
              <View style={styles.formRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.govChipScroll}
                >
                  {TUNISIA_GOVERNORATES.map((gov) => (
                    <TouchableOpacity
                      key={gov}
                      style={[styles.govChip, governorate === gov && styles.govChipActive]}
                      onPress={() => setGovernorate(gov)}
                    >
                      <Text
                        style={[
                          styles.govChipText,
                          governorate === gov && styles.govChipTextActive,
                        ]}
                      >
                        {gov}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </IOSGroupedList>

            {/* Role Selection */}
            <IOSGroupedList header={t('ui_account.research_role')}>
              <View style={styles.rolePickerRow}>
                <IOSSegmentedControl<'surveyor' | 'volunteer' | 'researcher'>
                  selectedValue={role}
                  onValueChange={setRole}
                  values={[
                    { label: t('ui_account.surveyor'), value: 'surveyor' },
                    { label: t('ui_account.volunteer'), value: 'volunteer' },
                    { label: t('ui_account.researcher'), value: 'researcher' },
                  ]}
                />
              </View>
            </IOSGroupedList>

            <View style={styles.actionPadding}>
              <IOSButton
                title={
                  userAccount
                    ? t('ui_account.save_changes')
                    : t('ui_account.create_surveyor_account')
                }
                onPress={handleCreateOrUpdate}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // Active Profile View
  const displayName = userAccount?.name || session?.user?.email?.split('@')[0] || 'Field Surveyor';
  const displayOrg = userAccount?.organization || 'Tunisia Fauna Observatory';
  const displayRole = (userAccount?.role || 'surveyor').toUpperCase();
  const displayId =
    userAccount?.surveyorId ||
    (session?.user?.id ? `OBS-${session.user.id.slice(0, 6).toUpperCase()}` : 'TUN-OBS-01');

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.outerContainer, { backgroundColor: colors.screenBg }]}>
      <LinearGradient
        colors={colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Reference 3: Organic Sunset Mesh Header */}
          <LinearGradient
            colors={['#DD4B34', '#ED6C44', '#FBA567']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.curvedHeader}
          >
            <View style={styles.headerTopRow}>
              <View>
                <Text style={styles.welcomeSubLabel}>{t('ui_account.observatory_profile')}</Text>
                <Text style={styles.headerTitle}>{displayName}</Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={toggleTheme}
                  activeOpacity={0.7}
                  accessibilityLabel={t('ui_account.toggle_day_night_mode')}
                >
                  <IOSIcon
                    name={themeMode === 'night' ? 'moon' : 'sun'}
                    size={17}
                    color="#0F172A"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.headerIconBtn}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.7}
                >
                  <IOSIcon name="pencil" size={17} color="#0F172A" />
                </TouchableOpacity>
                {onOpenSettings && (
                  <TouchableOpacity
                    style={styles.headerIconBtn}
                    onPress={onOpenSettings}
                    activeOpacity={0.7}
                  >
                    <IOSIcon name="gear" size={17} color="#0F172A" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Reference 3: Translucent Floating Capsule Badge */}
            <View style={styles.claimsPill}>
              <View style={styles.claimsBadgeSquare}>
                <Text style={styles.claimsBadgeNumber}>{stats.sessionsCompleted}</Text>
              </View>
              <Text style={styles.claimsPillText}>
                {stats.sessionsCompleted > 0
                  ? t('ui_account.active_survey_patrols_completed', { v0: stats.sessionsCompleted })
                  : t('ui_account.ready_for_first_standardized_transect')}
              </Text>
              <IOSIcon name="chevronRight" size={13} color="#FFFFFF" />
            </View>
          </LinearGradient>

          {/* Reference 2: Overlapping Profile Card */}
          <View style={styles.profileOverlappingCard}>
            <TouchableOpacity
              style={styles.avatarLargeWrapper}
              activeOpacity={0.8}
              onPress={handlePickAvatar}
            >
              {userAccount?.avatarUri ? (
                <Image source={{ uri: userAccount.avatarUri }} style={styles.avatarLargeImage} />
              ) : (
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarLargeText}>{initials}</Text>
                </View>
              )}
              <View style={styles.avatarCameraBadge}>
                <IOSIcon name="camera" size={12} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <View style={styles.profileDetails}>
              <Text style={styles.profileNameLarge}>{displayName}</Text>
              <Text style={styles.profileRoleText}>{displayRole}</Text>
              <Text style={styles.profileOrgText}>{displayOrg}</Text>
              <View style={styles.surveyorBadge}>
                <IOSIcon name="shield" size={12} color="#0F172A" />
                <Text style={styles.surveyorBadgeText}>{displayId}</Text>
              </View>
            </View>
          </View>

          {/* OxeliaMetrix Bento Statistics Grid (Ref: Picture 1) */}
          <View style={styles.bentoContainer}>
            {/* Primary Bento Hero Tile: Reference 1 Electric Citron */}
            <View style={styles.bentoHeroTileCitron}>
              <View style={styles.bentoHeroTopRow}>
                <View style={styles.bentoLabelRow}>
                  <Text style={styles.bentoLabelTextDark}>
                    {t('ui_account.field_sampling_effort')}
                  </Text>
                </View>
                <View style={styles.bentoAccentPillDark}>
                  <Text style={styles.bentoAccentTextDark}>{t('ui_account.tier_1')}</Text>
                </View>
              </View>

              <View style={styles.bentoHeroMainRow}>
                <Text style={styles.bentoHeroNumberDark}>{stats.sessionsCompleted}</Text>
                <Text style={styles.bentoHeroUnitDark}>{t('ui_account.surveys')}</Text>
              </View>

              <Text style={styles.bentoHeroSubtextDark}>
                {t('ui_account.completed_standardized_transects_verified_teleme')}
              </Text>

              {/* Black progress bar just like Reference 1! */}
              <View style={styles.bentoProgressTrackDark}>
                <View
                  style={[
                    styles.bentoProgressFillDark,
                    { width: `${Math.min(100, Math.max(12, stats.sessionsCompleted * 10))}%` },
                  ]}
                />
              </View>
            </View>

            {/* Secondary Bento Grid Tiles */}
            <View style={styles.bentoSplitRow}>
              {/* Distance Bento Tile */}
              <View style={styles.bentoSubTile}>
                <View style={styles.bentoSubTopRow}>
                  <View style={[styles.bentoSubIconBadge, { backgroundColor: '#FFEDE8' }]}>
                    <IOSIcon name="location" size={13} color="#DD4B34" />
                  </View>
                  <Text style={styles.bentoSubLabel}>{t('ui_account.patrol_distance')}</Text>
                </View>
                <View style={styles.bentoSubValRow}>
                  <Text style={styles.bentoSubNumber}>{stats.kmWalked.toFixed(1)}</Text>
                  <Text style={styles.bentoSubUnit}>{t('ui_account.km')}</Text>
                </View>
                <Text style={styles.bentoSubFooter}>{t('ui_account.geo_tracked_corridor')}</Text>
              </View>

              {/* Efficiency Tile (Reference 1 Dark Tile with Citron Glow) */}
              <View
                style={[
                  styles.bentoSubTile,
                  { backgroundColor: '#111827', borderColor: '#1F2937' },
                ]}
              >
                <View style={styles.bentoSubTopRow}>
                  <View
                    style={[
                      styles.bentoSubIconBadge,
                      { backgroundColor: 'rgba(217, 249, 68, 0.18)' },
                    ]}
                  >
                    <IOSIcon name="paw" size={13} color="#D9F944" />
                  </View>
                  <View style={styles.citronSmallBadge}>
                    <Text style={styles.citronSmallBadgeText}>+40%</Text>
                  </View>
                </View>
                <View style={styles.bentoSubValRow}>
                  <Text style={[styles.bentoSubNumber, { color: '#FFFFFF' }]}>
                    {stats.animalsRecorded}
                  </Text>
                  <Text style={[styles.bentoSubUnit, { color: '#D9F944' }]}>
                    {t('ui_account.animals')}
                  </Text>
                </View>
                <Text style={[styles.bentoSubFooter, { color: '#94A3B8' }]}>
                  {t('ui_account.observed_census')}
                </Text>
              </View>
            </View>
          </View>

          {/* Reference 3: Official Field Credential Card (e-Card Pass) */}
          <LinearGradient
            colors={['#DD4B34', '#ED6C44', '#FBA567']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.credentialCard}
          >
            <View style={styles.credentialHeader}>
              <View style={styles.credentialHeaderLeft}>
                <View style={styles.credentialEmblem}>
                  <IOSIcon name="shield" size={14} color="#FFFFFF" />
                </View>
                <View>
                  <Text style={styles.credentialOrg}>{t('ui_account.republique_tunisienne')}</Text>
                  <Text style={styles.credentialSubOrg}>
                    {t('ui_account.institut_pasteur_de_tunis_observatoire')}
                  </Text>
                </View>
              </View>
              <View style={styles.credentialStatusBadge}>
                <View style={styles.credentialLiveDot} />
                <Text style={styles.credentialStatusText}>{t('ui_account.active')}</Text>
              </View>
            </View>

            <View style={styles.credentialBody}>
              <View>
                <Text style={styles.credentialName}>{displayName}</Text>
                <Text style={styles.credentialRole}>
                  {displayRole.toUpperCase()} • {userAccount?.governorate || t('ui_common.not_set')}
                </Text>
              </View>
              <View style={styles.credentialBarcodeWrapper}>
                <Text style={styles.credentialIdCode}>{displayId}</Text>
              </View>
            </View>

            <View style={styles.credentialFooter}>
              <Text style={styles.credentialFooterText}>
                {t('ui_account.icam_woh_standards_authorized_observer')}
              </Text>
              <Text style={styles.credentialIssueDate}>{t('ui_account.valid_2026_2027')}</Text>
            </View>
          </LinearGradient>

          {/* Reference 2: About Section */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>{t('ui_account.about')}</Text>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutText}>
                {t('ui_account.field_observer_specialized_in_street_animal')}
              </Text>
            </View>
          </View>

          {/* Reference 2: Upcoming activities Section */}
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionHeading}>{t('ui_account.upcoming_activities')}</Text>

            <View style={styles.activityCard}>
              <View style={[styles.activityIconBox, { backgroundColor: '#ECFDF5' }]}>
                <IOSIcon name="compass" size={20} color="#059669" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>
                  {t('ui_account.bab_souika_transect_survey')}
                </Text>
                <Text style={styles.activitySubtitle}>
                  {t('ui_account.may_30_2026_icam_protocol_tier')}
                </Text>
              </View>
              <View style={styles.activityArrowBtn}>
                <IOSIcon name="chevronRight" size={13} color="#0F172A" />
              </View>
            </View>

            <View style={styles.activityCard}>
              <View style={[styles.activityIconBox, { backgroundColor: '#EFF6FF' }]}>
                <IOSIcon name="paw" size={20} color="#2563EB" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{t('ui_account.medina_cat_colony_census')}</Text>
                <Text style={styles.activitySubtitle}>
                  {t('ui_account.june_04_2026_tnr_ear_tipping')}
                </Text>
              </View>
              <View style={styles.activityArrowBtn}>
                <IOSIcon name="chevronRight" size={13} color="#0F172A" />
              </View>
            </View>

            <View style={styles.activityCard}>
              <View style={[styles.activityIconBox, { backgroundColor: '#FFFBEB' }]}>
                <IOSIcon name="chart" size={20} color="#D97706" />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>
                  {t('ui_account.secr_distance_sampling_run')}
                </Text>
                <Text style={styles.activitySubtitle}>
                  {t('ui_account.continuous_detection_matrix_logging')}
                </Text>
              </View>
              <View style={styles.activityArrowBtn}>
                <IOSIcon name="chevronRight" size={13} color="#0F172A" />
              </View>
            </View>
          </View>

          {/* Protocols Shortcut */}
          {onOpenTraining ? (
            <IOSGroupedList header={t('ui_account.research_standards')}>
              <IOSListRow
                title={t('ui_account.methodology_protocol_guide')}
                subtitle={t('ui_account.icam_1_5_distance_sampling_photography')}
                icon="info"
                iconColor={IOSColors.systemTeal}
                showDisclosure
                isLast
                onPress={onOpenTraining}
              />
            </IOSGroupedList>
          ) : null}

          {/* Visual Appearance & Theme */}
          <IOSGroupedList header={t('ui_account.appearance_visuals')}>
            <IOSListRow
              title={
                themeMode === 'night'
                  ? t('ui_account.night_mode_nocturnal')
                  : t('ui_account.day_mode_standard')
              }
              subtitle={
                themeMode === 'night'
                  ? t('ui_account.high_contrast_nocturnal_oled_theme')
                  : t('ui_account.soft_porcelain_daylight_theme')
              }
              icon={themeMode === 'night' ? 'moon' : 'sun'}
              iconColor={themeMode === 'night' ? '#818CF8' : '#F59E0B'}
              rightComponent={
                <Switch
                  value={themeMode === 'night'}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#CBD5E1', true: '#4F46E5' }}
                  thumbColor="#FFFFFF"
                />
              }
              isLast
            />
          </IOSGroupedList>

          {onSignOut ? (
            <View style={styles.actionPadding}>
              <IOSButton
                title={t('ui_account.switch_account')}
                variant="secondary"
                onPress={onSignOut}
              />
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F7F6F2',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  curvedHeader: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 16,
    paddingBottom: 48,
    paddingHorizontal: 20,
    shadowColor: '#DD4B34',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeSubLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFE8DF',
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  claimsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    gap: 8,
  },
  claimsBadgeSquare: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimsBadgeNumber: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DD4B34',
  },
  claimsPillText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileOverlappingCard: {
    marginTop: -28,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarLargeWrapper: {
    position: 'relative',
  },
  avatarLarge: {
    width: 66,
    height: 66,
    borderRadius: 22,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeImage: {
    width: 66,
    height: 66,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginVertical: 16,
  },
  editAvatarTouch: {
    position: 'relative',
  },
  editAvatarImage: {
    width: 80,
    height: 80,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: IOSColors.systemTeal,
  },
  editAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editAvatarInitials: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editAvatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoBtn: {
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  changePhotoText: {
    fontSize: 13,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  govChipScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  govChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  govChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  govChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  govChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  avatarEmblemBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DD4B34',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
    gap: 2,
  },
  profileNameLarge: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  profileRoleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileOrgText: {
    fontSize: 13,
    color: '#64748B',
  },
  surveyorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  surveyorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },

  sectionBlock: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aboutText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  activityIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  brandHero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
  },
  heroLogoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(8, 145, 178, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: IOSColors.label,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
  },
  formRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  topBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  inputLabel: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  textInput: {
    ...IOSTypography.body,
    color: IOSColors.label,
    padding: 0,
  },
  rolePickerRow: {
    padding: 14,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  actionPadding: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 32,
  },
  editText: {
    ...IOSTypography.headline,
    color: IOSColors.systemTeal,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    gap: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IOSColors.systemTeal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    ...IOSTypography.title3,
    fontWeight: '700',
  },
  profileOrg: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(8, 145, 178, 0.10)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  bentoContainer: {
    marginHorizontal: 16,
    marginTop: 14,
    gap: 10,
  },
  bentoHeroTileCitron: {
    backgroundColor: '#D9F944',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#D9F944',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  bentoHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bentoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bentoLabelTextDark: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.8,
  },
  bentoAccentPillDark: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  bentoAccentTextDark: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D9F944',
    letterSpacing: 0.4,
  },
  bentoHeroMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 4,
  },
  bentoHeroNumberDark: {
    fontSize: 42,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -1,
  },
  bentoHeroUnitDark: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  bentoHeroSubtextDark: {
    fontSize: 12,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 14,
  },
  bentoProgressTrackDark: {
    height: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bentoProgressFillDark: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 4,
  },
  citronSmallBadge: {
    backgroundColor: '#D9F944',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  citronSmallBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  bentoSplitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bentoSubTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bentoSubTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  bentoSubIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  bentoSubValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
  },
  bentoSubNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  bentoSubUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  bentoSubFooter: {
    fontSize: 11,
    color: '#94A3B8',
  },
  credentialCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 22,
    padding: 18,
    shadowColor: '#DD4B34',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 6,
  },
  credentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  credentialHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  credentialEmblem: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  credentialOrg: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.8,
  },
  credentialSubOrg: {
    fontSize: 9,
    color: '#94A3B8',
  },
  credentialStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  credentialLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  credentialStatusText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 0.5,
  },
  credentialBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  credentialName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  credentialRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  credentialBarcodeWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  credentialIdCode: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 1.2,
  },
  credentialFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.10)',
  },
  credentialFooterText: {
    fontSize: 9,
    color: '#64748B',
  },
  credentialIssueDate: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  activityArrowBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
