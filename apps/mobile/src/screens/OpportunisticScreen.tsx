import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Species,
  Sex,
  AgeClass,
  ReproductiveStatus,
  BodyConditionScore,
  HealthIssue,
  YesNoUnknown,
  AnimalBehaviour,
  HabitatType,
} from '@tunisia-survey/shared';
import { IOSColors, IOSTypography } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSGroupedList,
  IOSListRow,
  IOSButton,
  IOSIcon,
} from '../components/ios';
import { generateOpportunisticCode } from '../utils/scientificCodes';
import {
  hapticTabSwitch,
  hapticButtonPress,
  hapticQuickLog,
  hapticModalClose,
} from '../utils/haptics';

interface IcamBcsTier {
  score: BodyConditionScore;
  name: string;
  status: string;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  cues: string;
}

const ICAM_BCS_TIERS: IcamBcsTier[] = [
  {
    score: 1,
    name: 'ui_opportunistic.score_1_emaciated',
    status: 'ui_opportunistic.critical_alert',
    accentColor: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    cues: 'Ribs and hips severely prominent; zero fat cover',
  },
  {
    score: 2,
    name: 'ui_opportunistic.score_2_underweight',
    status: 'ui_opportunistic.lean_frame',
    accentColor: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    cues: 'Ribs easily visible; pronounced waist tuck',
  },
  {
    score: 3,
    name: 'ui_opportunistic.score_3_ideal',
    status: 'ui_opportunistic.icam_benchmark',
    accentColor: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    cues: 'Ribs palpable with light fat; healthy proportions',
  },
  {
    score: 4,
    name: 'ui_opportunistic.score_4_overweight',
    status: 'ui_opportunistic.heavy_cover',
    accentColor: '#F59E0B',
    bgColor: '#FFFBEB',
    borderColor: '#FDE68A',
    cues: 'Ribs difficult to palpate; rounded abdomen',
  },
  {
    score: 5,
    name: 'ui_opportunistic.score_5_obese',
    status: 'ui_opportunistic.high_risk',
    accentColor: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    cues: 'Massive fat deposits over spine, chest & tail base',
  },
];

const AGE_CLASS_OPTIONS: { label: string; value: AgeClass }[] = [
  { label: 'ui_opportunistic.adult', value: 'adult' },
  { label: 'ui_opportunistic.juvenile_kitten_puppy', value: 'juvenile' },
  { label: 'ui_opportunistic.unknown', value: 'unknown' },
];

const COLLAR_OPTIONS: { label: string; value: YesNoUnknown }[] = [
  { label: 'ui_opportunistic.no_collar_free_roaming', value: 'no' },
  { label: 'ui_opportunistic.collared_tagged_owned', value: 'yes' },
  { label: 'ui_opportunistic.uncertain', value: 'unknown' },
];

const HABITAT_OPTIONS: { label: string; value: HabitatType }[] = [
  { label: 'ui_opportunistic.residential_street', value: 'residential' },
  { label: 'ui_opportunistic.market_souk', value: 'market' },
  { label: 'ui_opportunistic.waste_dump_bin_site', value: 'landfill_garbage_site' },
  { label: 'ui_opportunistic.commercial_zone', value: 'commercial' },
  { label: 'ui_opportunistic.port_coastal_area', value: 'beach_coastal' },
  { label: 'ui_opportunistic.rural_agricultural', value: 'agricultural' },
  { label: 'ui_opportunistic.slaughterhouse_perimeter', value: 'slaughterhouse_vicinity' },
  { label: 'ui_opportunistic.natural_parkland', value: 'natural_area' },
  { label: 'ui_opportunistic.other', value: 'other' },
];

const TEMPERAMENT_OPTIONS: { label: string; value: AnimalBehaviour }[] = [
  { label: 'ui_opportunistic.approachable', value: 'approachable' },
  { label: 'ui_opportunistic.neutral', value: 'neutral' },
  { label: 'ui_opportunistic.fearful', value: 'fearful' },
  { label: 'ui_opportunistic.aggressive', value: 'aggressive' },
];

const HEALTH_ISSUE_OPTIONS: { key: HealthIssue; label: string }[] = [
  { key: 'none', label: 'ui_opportunistic.healthy_no_issues' },
  { key: 'skin_lesions_mange', label: 'ui_opportunistic.skin_lesions_mange' },
  { key: 'wound', label: 'ui_opportunistic.open_wound' },
  { key: 'limp', label: 'ui_opportunistic.limping_mobility_issue' },
  { key: 'eye_nose_discharge', label: 'ui_opportunistic.eye_nose_discharge' },
  { key: 'tumour', label: 'ui_opportunistic.tumour_growth_tvt' },
];

const QUICK_NOTE_CHIPS = [
  'Friendly & approachable',
  'Timid / retreats',
  'Part of colony / pack',
  'Near waste container',
  'Actively being fed',
  'Ear notched / TNR',
  'Needs veterinary check',
];

interface OpportunisticScreenProps {
  onBack: () => void;
  onOpenPhotoCapture: () => void;
  onSaveObservation: (data: any) => void;
  capturedPhotosCount: number;
  capturedPhotos?: any[];
  onClearPhotos?: () => void;
}

export const OpportunisticScreen: React.FC<OpportunisticScreenProps> = ({
  onBack,
  onOpenPhotoCapture,
  onSaveObservation,
  capturedPhotosCount,
  capturedPhotos = [],
  onClearPhotos,
}) => {
  const { t } = useTranslation();

  const [species, setSpecies] = useState<Species>('cat');
  const [identifier, setIdentifier] = useState<string>('');
  const [groupSize, setGroupSize] = useState<number>(1);
  const [sex, setSex] = useState<Sex>('unknown');
  const [ageClass, setAgeClass] = useState<AgeClass>('adult');
  const [reproductiveStatus, setReproductiveStatus] = useState<ReproductiveStatus>('none_visible');
  const [bcs, setBcs] = useState<BodyConditionScore>(3);
  const [healthIssues, setHealthIssues] = useState<HealthIssue[]>(['none']);
  const [earTip, setEarTip] = useState<YesNoUnknown>('unknown');
  const [collar, setCollar] = useState<YesNoUnknown>('no');
  const [behaviour, setBehaviour] = useState<AnimalBehaviour>('neutral');
  const [habitat, setHabitat] = useState<HabitatType>('residential');
  const [notes, setNotes] = useState<string>('');

  // Georeference coordinates (silently recorded in background). Null until a
  // real fix arrives: a sighting is never stored at a made-up position.
  const [deviceLat, setDeviceLat] = useState<number | null>(null);
  const [deviceLon, setDeviceLon] = useState<number | null>(null);

  useEffect(() => {
    async function getGPS() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setDeviceLat(loc.coords.latitude);
          setDeviceLon(loc.coords.longitude);
        }
      } catch (err) {
        // No fix yet; handleSave retries
      }
    }
    getGPS();
  }, []);

  const handleSexChange = (newSex: Sex) => {
    setSex(newSex);
    // Biological sanity check: male animals cannot be lactating or pregnant
    if (newSex === 'male') {
      if (reproductiveStatus === 'lactating' || reproductiveStatus === 'visibly_pregnant') {
        setReproductiveStatus('none_visible');
      }
    }
  };

  const toggleHealthIssue = (issue: HealthIssue) => {
    if (issue === 'none') {
      setHealthIssues(['none']);
      return;
    }
    const filtered = healthIssues.filter((h) => h !== 'none');
    if (filtered.includes(issue)) {
      const next = filtered.filter((h) => h !== issue);
      setHealthIssues(next.length === 0 ? ['none'] : next);
    } else {
      setHealthIssues([...filtered, issue]);
    }
  };

  const handleSave = async () => {
    hapticButtonPress();

    let lat = deviceLat;
    let lon = deviceLon;
    if (lat === null || lon === null) {
      try {
        const loc =
          (await Location.getLastKnownPositionAsync()) ||
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
        setDeviceLat(lat);
        setDeviceLon(lon);
      } catch {}
    }
    if (lat === null || lon === null) {
      Alert.alert(t('opportunistic.no_gps_title'), t('opportunistic.no_gps_body'));
      return;
    }

    const cleanId =
      identifier.trim() || generateOpportunisticCode(species, Math.floor(Date.now() / 1000) % 1000);
    onSaveObservation({
      identifier: cleanId,
      species,
      group_size: groupSize,
      sex,
      age_class: ageClass,
      reproductive_status: reproductiveStatus,
      body_condition_score: bcs,
      visible_health_issues: healthIssues,
      ear_tip_or_notch: earTip,
      collar_or_tag: collar,
      behaviour,
      habitat_type: habitat,
      notes,
      protocol: 'incidental',
      latitude: lat,
      longitude: lon,
      observed_at: new Date().toISOString(),
    });
  };

  const selectedBcsTier = ICAM_BCS_TIERS.find((tier) => tier.score === bcs) || ICAM_BCS_TIERS[2];

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <IOSNavigationBar
          title={t('ui_opportunistic.log_observation')}
          onBack={() => {
            hapticModalClose();
            onBack();
          }}
          backTitle={t('common.cancel')}
          rightAction={
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveActionText}>{t('common.save')}</Text>
            </TouchableOpacity>
          }
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Photo Capture Inset Group */}
            <IOSGroupedList
              header={t('ui_opportunistic.identification_photos')}
              footer={t('ui_opportunistic.multi_angle_photos_enable_capture_recapture')}
            >
              <IOSListRow
                title={t('photo.guided_title')}
                subtitle={
                  capturedPhotosCount > 0
                    ? t('ui_opportunistic.angles_captured', { count: capturedPhotosCount })
                    : t('ui_opportunistic.left_flank_right_flank_face')
                }
                icon="camera"
                iconColor={IOSColors.systemTeal}
                showDisclosure
                value={
                  capturedPhotosCount > 0
                    ? t('ui_opportunistic.attached', { capturedPhotosCount })
                    : t('ui_opportunistic.take_photo')
                }
                isLast
                onPress={onOpenPhotoCapture}
              />

              {capturedPhotosCount > 0 && (
                <View style={styles.photoThumbnailsContainer}>
                  <View style={styles.photoThumbHeader}>
                    <Text style={styles.photoThumbCountText}>
                      {t('ui_opportunistic.photos_attached', { count: capturedPhotosCount })}
                    </Text>
                    {onClearPhotos && (
                      <TouchableOpacity onPress={onClearPhotos} activeOpacity={0.7}>
                        <Text style={styles.photoClearBtnText}>
                          {t('ui_opportunistic.clear_all')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.photoThumbnailsScroll}
                  >
                    {(capturedPhotos && capturedPhotos.length > 0
                      ? capturedPhotos
                      : Array.from({ length: capturedPhotosCount }, (_, i) => `photo_${i + 1}`)
                    ).map((photoItem, idx) => {
                      const angleLabel =
                        idx === 0 ? 'Left Flank' : idx === 1 ? 'Right Flank' : 'Face / Head';
                      const photoUri =
                        typeof photoItem === 'string' ? photoItem : photoItem?.uri || '';
                      const isRealUri =
                        typeof photoUri === 'string' &&
                        (photoUri.startsWith('file:') ||
                          photoUri.startsWith('http') ||
                          photoUri.startsWith('data:'));
                      return (
                        <View key={idx} style={styles.photoThumbCard}>
                          {isRealUri ? (
                            <Image source={{ uri: photoUri }} style={styles.photoThumbImage} />
                          ) : (
                            <View style={styles.photoThumbFallback}>
                              <IOSIcon name="camera" size={20} color="#0891B2" />
                            </View>
                          )}
                          <View style={styles.photoThumbTag}>
                            <Text style={styles.photoThumbTagText}>{angleLabel}</Text>
                          </View>
                          <View style={styles.photoThumbNumberBadge}>
                            <Text style={styles.photoThumbNumberText}>#{idx + 1}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </IOSGroupedList>

            {/* Species & Abundance */}
            <IOSGroupedList header={t('ui_opportunistic.species_abundance')}>
              <View style={styles.speciesCardContainer}>
                <TouchableOpacity
                  style={[styles.speciesCard, species === 'cat' && styles.speciesCardCatActive]}
                  onPress={() => {
                    hapticTabSwitch();
                    setSpecies('cat');
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.speciesAvatarCircle,
                      { backgroundColor: species === 'cat' ? '#E0F2FE' : '#F1F5F9' },
                    ]}
                  >
                    <Image
                      source={require('../../assets/icon_cat_primary.png')}
                      style={{ width: 34, height: 34, resizeMode: 'contain' }}
                    />
                  </View>
                  <View style={styles.speciesCardInfo}>
                    <Text
                      style={[styles.speciesCardTitle, species === 'cat' && { color: '#0284C7' }]}
                    >
                      {t('animal.cat')}
                    </Text>
                    <Text style={styles.speciesCardSubtitle}>
                      {t('ui_opportunistic.felis_catus')}
                    </Text>
                  </View>
                  {species === 'cat' && (
                    <View style={[styles.speciesCheckBadge, { backgroundColor: '#0284C7' }]}>
                      <IOSIcon name="check" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.speciesCard, species === 'dog' && styles.speciesCardDogActive]}
                  onPress={() => {
                    hapticTabSwitch();
                    setSpecies('dog');
                  }}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.speciesAvatarCircle,
                      { backgroundColor: species === 'dog' ? '#FEF3C7' : '#F1F5F9' },
                    ]}
                  >
                    <Image
                      source={require('../../assets/icon_dog_amber.png')}
                      style={{ width: 34, height: 34, resizeMode: 'contain' }}
                    />
                  </View>
                  <View style={styles.speciesCardInfo}>
                    <Text
                      style={[styles.speciesCardTitle, species === 'dog' && { color: '#D97706' }]}
                    >
                      {t('animal.dog')}
                    </Text>
                    <Text style={styles.speciesCardSubtitle}>
                      {t('ui_opportunistic.canis_familiaris')}
                    </Text>
                  </View>
                  {species === 'dog' && (
                    <View style={[styles.speciesCheckBadge, { backgroundColor: '#F59E0B' }]}>
                      <IOSIcon name="check" size={12} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Group Size with Quick Presets */}
              <View style={[styles.groupSizeSection, styles.topDivider]}>
                <View style={styles.groupSizeHeaderRow}>
                  <Text style={styles.chipRowLabel}>{t('animal.group_size')}</Text>
                  <Text style={styles.groupSizeHint}>
                    {groupSize === 1
                      ? t('ui_opportunistic.solitary_animal')
                      : groupSize <= 3
                        ? t('ui_opportunistic.small_group')
                        : t('ui_opportunistic.pack_litter')}
                  </Text>
                </View>
                <View style={styles.groupSizeControlsRow}>
                  <View style={styles.stepperContainer}>
                    <TouchableOpacity
                      onPress={() => {
                        hapticQuickLog();
                        setGroupSize(Math.max(1, groupSize - 1));
                      }}
                      style={styles.stepperBtn}
                    >
                      <IOSIcon name="minus" size={12} color={IOSColors.systemTeal} />
                    </TouchableOpacity>
                    <Text style={styles.stepperVal}>{groupSize}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        hapticQuickLog();
                        setGroupSize(groupSize + 1);
                      }}
                      style={styles.stepperBtn}
                    >
                      <IOSIcon name="plus" size={12} color={IOSColors.systemTeal} />
                    </TouchableOpacity>
                  </View>

                  {/* 1-Tap Quick Presets */}
                  <View style={styles.quickPresetRow}>
                    {[1, 2, 3, 5, 8].map((preset) => {
                      const isSelected = groupSize === preset;
                      return (
                        <TouchableOpacity
                          key={preset}
                          style={[
                            styles.quickPresetPill,
                            isSelected && styles.quickPresetPillActive,
                          ]}
                          onPress={() => {
                            hapticTabSwitch();
                            setGroupSize(preset);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.quickPresetPillText,
                              isSelected && styles.quickPresetPillTextActive,
                            ]}
                          >
                            {preset === 8 ? '8+' : preset}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </IOSGroupedList>

            {/* Observation Identifier / Field Tag */}
            <IOSGroupedList
              header={t('ui_opportunistic.observation_identifier_tag_optional')}
              footer={t('ui_opportunistic.give_this_animal_or_sighting_a')}
            >
              <View style={styles.identifierRow}>
                <IOSIcon name="paw" size={18} color={species === 'cat' ? '#0284C7' : '#D97706'} />
                <TextInput
                  style={styles.identifierInput}
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder={t('ui_opportunistic.e_g_or_tag', {
                    v0: species === 'cat' ? 'Market Tabby' : 'Rex (Bakery Corner)',
                  })}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="words"
                />
                {identifier.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setIdentifier('')}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IOSIcon name="xmark" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>
            </IOSGroupedList>

            {/* Compact ICAM Body Condition Score (BCS 1 to 5) Bar */}
            <IOSGroupedList
              header={t('animal.bcs_title')}
              footer={t('ui_opportunistic.standardized_icam_5_point_body_condition')}
            >
              <View style={styles.bcsContainer}>
                {/* 5-Segment Visual Bar */}
                <View style={styles.bcsSegmentBar}>
                  {ICAM_BCS_TIERS.map((tier) => {
                    const isSelected = bcs === tier.score;
                    return (
                      <TouchableOpacity
                        key={tier.score}
                        style={[
                          styles.bcsSegment,
                          {
                            backgroundColor: isSelected ? tier.accentColor : '#F1F5F9',
                            borderColor: isSelected ? tier.accentColor : '#E2E8F0',
                          },
                        ]}
                        onPress={() => {
                          hapticTabSwitch();
                          setBcs(tier.score);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.bcsSegmentNum,
                            { color: isSelected ? '#FFFFFF' : '#475569' },
                          ]}
                        >
                          {tier.score}
                        </Text>
                        <View
                          style={[
                            styles.bcsSegmentDot,
                            {
                              backgroundColor: isSelected ? '#FFFFFF' : tier.accentColor,
                            },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Active Score Clinical Diagnostic Card */}
                <View
                  style={[
                    styles.bcsActiveCard,
                    {
                      backgroundColor: selectedBcsTier.bgColor,
                      borderColor: selectedBcsTier.borderColor,
                    },
                  ]}
                >
                  <View style={styles.bcsActiveHeader}>
                    <Text style={[styles.bcsActiveTitle, { color: selectedBcsTier.accentColor }]}>
                      {t(selectedBcsTier.name)}
                    </Text>
                    <View
                      style={[
                        styles.bcsActiveBadge,
                        { backgroundColor: selectedBcsTier.borderColor },
                      ]}
                    >
                      <Text
                        style={[styles.bcsActiveBadgeText, { color: selectedBcsTier.accentColor }]}
                      >
                        {t(selectedBcsTier.status)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bcsActiveCues}>{selectedBcsTier.cues}</Text>
                </View>
              </View>
            </IOSGroupedList>

            {/* Demographics & Sterilization */}
            <IOSGroupedList header={t('ui_opportunistic.demographics_sterilization')}>
              {/* Sex Selection */}
              <View style={styles.chipRowSection}>
                <Text style={styles.chipRowLabel}>{t('animal.sex')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {[
                    { label: t('ui_opportunistic.male'), value: 'male' as Sex },
                    { label: t('ui_opportunistic.female'), value: 'female' as Sex },
                    { label: t('ui_opportunistic.unknown'), value: 'unknown' as Sex },
                  ].map((opt) => {
                    const isSelected = sex === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          handleSexChange(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Age Class Selection */}
              <View style={[styles.chipRowSection, styles.topDivider]}>
                <Text style={styles.chipRowLabel}>{t('ui_opportunistic.age_class')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {AGE_CLASS_OPTIONS.map((opt) => {
                    const isSelected = ageClass === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          setAgeClass(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Collar / Ownership Status */}
              <View style={[styles.chipRowSection, styles.topDivider]}>
                <Text style={styles.chipRowLabel}>
                  {t('ui_opportunistic.collar_tag_ownership')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {COLLAR_OPTIONS.map((opt) => {
                    const isSelected = collar === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          setCollar(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Ear-Tip (TNR) Selection */}
              <View style={[styles.chipRowSection, styles.topDivider]}>
                <Text style={styles.chipRowLabel}>{t('animal.ear_tip')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {[
                    {
                      label: t('ui_opportunistic.ear_tipped_yes'),
                      value: 'yes' as YesNoUnknown,
                      hasIcon: true,
                    },
                    {
                      label: t('ui_opportunistic.intact_no'),
                      value: 'no' as YesNoUnknown,
                      hasIcon: false,
                    },
                    {
                      label: t('ui_opportunistic.uncertain_2'),
                      value: 'unknown' as YesNoUnknown,
                      hasIcon: false,
                    },
                  ].map((opt) => {
                    const isSelected = earTip === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          setEarTip(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        {opt.hasIcon && (
                          <IOSIcon
                            name="shield"
                            size={12}
                            color={isSelected ? '#0284C7' : '#64748B'}
                          />
                        )}
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Reproductive Status Selection */}
              <View style={[styles.chipRowSection, styles.topDivider]}>
                <View style={styles.chipRowLabelRow}>
                  <Text style={styles.chipRowLabel}>{t('animal.reproductive')}</Text>
                  {sex === 'male' && (
                    <Text style={styles.chipRowNote}>{t('ui_opportunistic.female_only')}</Text>
                  )}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {(sex === 'male'
                    ? [
                        {
                          label: t('ui_opportunistic.none_visible'),
                          value: 'none_visible' as ReproductiveStatus,
                        },
                      ]
                    : [
                        {
                          label: t('ui_opportunistic.none_visible'),
                          value: 'none_visible' as ReproductiveStatus,
                        },
                        {
                          label: t('ui_opportunistic.lactating'),
                          value: 'lactating' as ReproductiveStatus,
                        },
                        {
                          label: t('ui_opportunistic.visibly_pregnant'),
                          value: 'visibly_pregnant' as ReproductiveStatus,
                        },
                      ]
                  ).map((opt) => {
                    const isSelected = reproductiveStatus === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          setReproductiveStatus(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </IOSGroupedList>

            {/* Temperament / Approach Behaviour */}
            <IOSGroupedList
              header={t('ui_opportunistic.temperament_approachability')}
              footer={t('ui_opportunistic.indicates_rabies_transmission_risk_public_safety')}
            >
              <View style={styles.chipRowSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {TEMPERAMENT_OPTIONS.map((opt) => {
                    const isSelected = behaviour === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          setBehaviour(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </IOSGroupedList>

            {/* Habitat / Ecological Context */}
            <IOSGroupedList
              header={t('ui_opportunistic.habitat_surroundings')}
              footer={t('ui_opportunistic.identifies_food_attractants_waste_disposal_point')}
            >
              <View style={styles.chipRowSection}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScrollRow}
                >
                  {HABITAT_OPTIONS.map((opt) => {
                    const isSelected = habitat === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.demographicChip, isSelected && styles.demographicChipActive]}
                        onPress={() => {
                          hapticTabSwitch();
                          setHabitat(opt.value);
                        }}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.demographicChipText,
                            isSelected && styles.demographicChipTextActive,
                          ]}
                        >
                          {t(opt.label)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </IOSGroupedList>

            {/* Visible Health Symptoms */}
            <IOSGroupedList
              header={t('animal.health_issues')}
              footer={t('ui_opportunistic.multi_select_visible_health_issues_tag')}
            >
              <View style={styles.healthTagCloud}>
                {HEALTH_ISSUE_OPTIONS.map((item) => {
                  const isChecked = healthIssues.includes(item.key);
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.healthTag, isChecked && styles.healthTagActive]}
                      onPress={() => {
                        hapticTabSwitch();
                        toggleHealthIssue(item.key);
                      }}
                      activeOpacity={0.75}
                    >
                      {isChecked && <IOSIcon name="check" size={13} color="#FFFFFF" />}
                      <Text style={[styles.healthTagText, isChecked && styles.healthTagTextActive]}>
                        {t(item.label)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </IOSGroupedList>

            {/* Field Notes & Quick-Insert Tags */}
            <IOSGroupedList header={t('animal.notes')}>
              <View style={styles.notesContainer}>
                {/* 1-Tap Quick Note Tags */}
                <View style={styles.quickTagsWrapper}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickTagsScroll}
                  >
                    {QUICK_NOTE_CHIPS.map((chip, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.quickTagPill}
                        onPress={() => {
                          hapticQuickLog();
                          setNotes((prev) => (prev ? `${prev}, ${chip}` : chip));
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickTagText}>+ {chip}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={t(
                    'ui_opportunistic.field_observations_coat_coloration_distinctive_m'
                  )}
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  multiline
                />
              </View>
            </IOSGroupedList>

            {/* Bottom Save Action */}
            <View style={styles.bottomBtnContainer}>
              <IOSButton
                title={t('ui_opportunistic.save_observation_record')}
                onPress={handleSave}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  scrollContent: {
    paddingVertical: 16,
    paddingBottom: 60,
  },
  saveActionText: {
    ...IOSTypography.headline,
    color: IOSColors.systemTeal,
  },
  topDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  // Species section
  speciesCardContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  identifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  identifierInput: {
    flex: 1,
    ...IOSTypography.body,
    fontSize: 15,
    color: IOSColors.label,
    padding: 0,
  },
  speciesCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  speciesCardCatActive: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
  },
  speciesCardDogActive: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  speciesAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesCardInfo: {
    flex: 1,
  },
  speciesCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOSColors.label,
  },
  speciesCardSubtitle: {
    fontSize: 11,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontStyle: 'italic',
  },
  speciesCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Group size controls
  groupSizeSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  groupSizeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupSizeHint: {
    fontSize: 12,
    fontWeight: '600',
    color: IOSColors.systemTeal,
  },
  groupSizeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: IOSColors.systemGray5,
    borderRadius: 8,
    padding: 2,
    gap: 4,
  },
  stepperBtn: {
    width: 32,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  stepperVal: {
    ...IOSTypography.headline,
    minWidth: 26,
    textAlign: 'center',
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  quickPresetPill: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPresetPillActive: {
    backgroundColor: '#F0F9FF',
    borderColor: IOSColors.systemTeal,
    borderWidth: 1.5,
  },
  quickPresetPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  quickPresetPillTextActive: {
    color: IOSColors.systemTeal,
    fontWeight: '800',
  },
  // Compact BCS Bar
  bcsContainer: {
    padding: 14,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  bcsSegmentBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  bcsSegment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  bcsSegmentNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  bcsSegmentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bcsActiveCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  bcsActiveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bcsActiveTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  bcsActiveBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bcsActiveBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bcsActiveCues: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  // Demographics chips
  chipRowSection: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  chipRowLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chipRowLabel: {
    ...IOSTypography.subheadline,
    fontWeight: '600',
    color: IOSColors.label,
    marginBottom: 8,
  },
  chipRowNote: {
    fontSize: 11,
    color: IOSColors.secondaryLabel,
    fontStyle: 'italic',
  },
  chipsScrollRow: {
    gap: 8,
    paddingVertical: 2,
  },
  demographicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  demographicChipActive: {
    backgroundColor: '#F0F9FF',
    borderColor: IOSColors.systemTeal,
  },
  demographicChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  demographicChipTextActive: {
    color: IOSColors.systemTeal,
    fontWeight: '700',
  },
  // Compact Health Tag Cloud
  healthTagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  healthTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  healthTagActive: {
    backgroundColor: IOSColors.systemTeal,
    borderColor: IOSColors.systemTeal,
  },
  healthTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  healthTagTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  // Notes & Quick Tags
  notesContainer: {
    padding: 12,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  quickTagsWrapper: {
    marginBottom: 10,
  },
  quickTagsScroll: {
    gap: 6,
  },
  quickTagPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  notesInput: {
    ...IOSTypography.body,
    minHeight: 70,
    textAlignVertical: 'top',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  bottomBtnContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 32,
  },
  // Photo thumbnails & AI
  photoThumbnailsContainer: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  photoThumbHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  photoThumbCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  photoClearBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: IOSColors.systemRed,
  },
  photoThumbnailsScroll: {
    gap: 10,
  },
  photoThumbCard: {
    position: 'relative',
    width: 86,
    height: 86,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  photoThumbFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
  },
  photoThumbTag: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  photoThumbTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoThumbNumberBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#0F172A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D9F944',
  },
  photoThumbNumberText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#D9F944',
  },
});
