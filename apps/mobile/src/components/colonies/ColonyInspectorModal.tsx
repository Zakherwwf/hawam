import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon } from '../ios';
import { CatColony, useColoniesStore } from '../../features/colonies/coloniesStore';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticTabSwitch,
  hapticSuccess,
} from '../../utils/haptics';

interface ColonyInspectorModalProps {
  visible: boolean;
  colony: CatColony | null;
  onClose: () => void;
}

const WELFARE_QUICK_TAGS_CAT = [
  'Water Station Replenished',
  'Food Available',
  'Unsterilized Cat Spotted',
  'Shelter Inspected',
  'Injured Cat Observed',
  'All Cats Healthy',
];

const WELFARE_QUICK_TAGS_DOG = [
  'Water Station Replenished',
  'Food Available',
  'Unsterilized Dog Spotted',
  'Shelter Inspected',
  'Injured Dog Observed',
  'Pack Calm & Healthy',
];

export const ColonyInspectorModal: React.FC<ColonyInspectorModalProps> = ({
  visible,
  colony,
  onClose,
}) => {
  const { t } = useTranslation();
  const { recordInspection } = useColoniesStore();
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [selectedQuickTags, setSelectedQuickTags] = useState<string[]>([]);
  const [isLoggingInspection, setIsLoggingInspection] = useState(false);

  if (!colony) return null;

  const isDog = colony.species === 'dog';
  const groupLabel = isDog ? 'Dog Pack' : 'Cat Colony';
  const animalNoun = isDog ? 'Dogs' : 'Cats';
  const animalNounLower = isDog ? 'dogs' : 'cats';
  const quickTags = isDog ? WELFARE_QUICK_TAGS_DOG : WELFARE_QUICK_TAGS_CAT;

  const tnrPercent = Math.round(
    (colony.tnrSterilizedCount / Math.max(1, colony.estimatedPopulation)) * 100
  );

  const getTnrColor = (pct: number) => {
    if (pct >= 75) return '#10B981';
    if (pct >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const handleCloseModal = () => {
    hapticModalClose();
    onClose();
  };

  const handleConfirmInspection = () => {
    hapticSuccess();
    const tagSummary =
      selectedQuickTags.length > 0 ? `[Tags: ${selectedQuickTags.join(', ')}]` : '';
    const fullNotes = [tagSummary, inspectionNotes.trim()].filter(Boolean).join(' • ');

    recordInspection(colony.id, fullNotes || undefined);
    setIsLoggingInspection(false);
    setInspectionNotes('');
    setSelectedQuickTags([]);
    Alert.alert(
      t('ui_colonyInspectorModal.inspection_recorded'),
      t('ui_colonyInspectorModal.welfare_check_logged_for_10_xp', { v0: colony.name }),
      [{ text: t('ui_colonyInspectorModal.ok'), onPress: handleCloseModal }]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCloseModal}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={handleCloseModal} style={styles.navBtn}>
            <Text style={styles.navBtnText}>{t('ui_colonyInspectorModal.done')}</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>
            {isDog
              ? t('ui_colonyInspectorModal.dog_pack_dossier')
              : t('ui_colonyInspectorModal.colony_dossier')}
          </Text>
          <View style={styles.navPlaceholder} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Card */}
          <View style={styles.headerCard}>
            <View style={styles.zoneRow}>
              <View style={[styles.zoneBadge, isDog && styles.zoneBadgeDog]}>
                <IOSIcon name="shield" size={13} color={isDog ? '#EA580C' : '#8B5CF6'} />
                <Text style={[styles.zoneBadgeText, isDog && styles.zoneBadgeTextDog]}>
                  {isDog
                    ? t('ui_colonyInspectorModal.dog_pack')
                    : t('ui_colonyInspectorModal.cat_colony')}{' '}
                  • {colony.zone.toUpperCase()}
                </Text>
              </View>
              <View style={[styles.popBadge, isDog && styles.popBadgeDog]}>
                <Text style={[styles.popBadgeText, isDog && styles.popBadgeTextDog]}>
                  ~{colony.estimatedPopulation} {animalNoun}
                </Text>
              </View>
            </View>

            <Text style={styles.colonyName}>{colony.name}</Text>
            <Text style={styles.coordsText}>
              {colony.latitude.toFixed(5)}° N, {colony.longitude.toFixed(5)}° E
            </Text>

            {/* Territory Map Snippet */}
            <View style={styles.territoryMapSnippet}>
              <Image
                source={require('../../../assets/hero_transect_corridor.jpg')}
                style={styles.territoryMapImage}
              />
              <View style={styles.territoryMapOverlay}>
                <View style={styles.territoryRadarCircle}>
                  <View style={styles.territoryRadarPulse} />
                  <IOSIcon name="location" size={16} color="#D9F944" />
                </View>
                <View style={styles.territoryInfoBar}>
                  <View style={styles.territoryPinBadge}>
                    <Text style={styles.territoryPinText}>
                      {isDog
                        ? t('ui_colonyInspectorModal.pack_territory_core')
                        : t('ui_colonyInspectorModal.colony_station_core')}
                    </Text>
                  </View>
                  <View style={styles.territoryRadiusPill}>
                    <Text style={styles.territoryRadiusText}>
                      {t('ui_colonyInspectorModal.core_radius_150m')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* TNR Sterilization Progress Card */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t('ui_colonyInspectorModal.tnr_sterilization_rate')}
              </Text>
              <Text style={[styles.tnrPercentText, { color: getTnrColor(tnrPercent) }]}>
                {tnrPercent}%
              </Text>
            </View>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, tnrPercent)}%`,
                    backgroundColor: getTnrColor(tnrPercent),
                  },
                ]}
              />
            </View>

            <View style={styles.tnrStatsRow}>
              <Text style={styles.tnrStatsText}>
                {t('ui_colonyInspectorModal.of', {
                  tnrSterilizedCount: colony.tnrSterilizedCount,
                  estimatedPopulation: colony.estimatedPopulation,
                  v5: isDog ? 'vaccinated & sterilized' : 'ear-tipped & sterilized',
                })}
              </Text>
              <Text style={styles.tnrTargetText}>
                {tnrPercent >= 75
                  ? t('ui_colonyInspectorModal.target_achieved_75')
                  : t('ui_colonyInspectorModal.needs_sterilization_drive')}
              </Text>
            </View>
          </View>

          {/* Infrastructure & Facilities */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('ui_colonyInspectorModal.station_facilities')}
            </Text>

            <View style={styles.facilityGrid}>
              <View
                style={[
                  styles.facilityPill,
                  colony.hasWaterStation && styles.facilityPillWaterActive,
                ]}
              >
                <IOSIcon
                  name="shield"
                  size={14}
                  color={colony.hasWaterStation ? '#0284C7' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.facilityPillText,
                    colony.hasWaterStation && styles.facilityPillTextWaterActive,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {colony.hasWaterStation
                    ? t('ui_colonyInspectorModal.water_station')
                    : t('ui_colonyInspectorModal.no_water')}
                </Text>
              </View>

              <View
                style={[styles.facilityPill, colony.hasShelter && styles.facilityPillShelterActive]}
              >
                <IOSIcon
                  name="shield"
                  size={14}
                  color={colony.hasShelter ? '#059669' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.facilityPillText,
                    colony.hasShelter && styles.facilityPillTextShelterActive,
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {colony.hasShelter
                    ? t('ui_colonyInspectorModal.shelter_installed')
                    : t('ui_colonyInspectorModal.no_shelter')}
                </Text>
              </View>
            </View>
          </View>

          {/* Caretaker & Feeding Schedule */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('ui_colonyInspectorModal.caretaker_feeding_schedule')}
            </Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ui_colonyInspectorModal.primary_caretaker')}</Text>
              <Text style={styles.infoValue}>{colony.caretakerName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ui_colonyInspectorModal.feeding_hours')}</Text>
              <Text style={styles.infoValue}>{colony.feedingSchedule}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('ui_colonyInspectorModal.last_inspected')}</Text>
              <Text style={styles.infoValue}>
                {t('ui_colonyInspectorModal.checks', {
                  v1: new Date(colony.lastInspectedAt).toLocaleDateString(),
                  inspectionsCount: colony.inspectionsCount,
                })}
              </Text>
            </View>

            {colony.notes && (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>{colony.notes}</Text>
              </View>
            )}
          </View>

          {/* Welfare Quick Inspection Tags */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                {t('ui_colonyInspectorModal.quick_welfare_assessment')}
              </Text>
              <Text style={styles.quickTagsSubtitle}>
                {t('ui_colonyInspectorModal.tap_to_log_indicators')}
              </Text>
            </View>

            <View style={styles.quickTagsGrid}>
              {quickTags.map((tag) => {
                const isSelected = selectedQuickTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.quickTagPill, isSelected && styles.quickTagPillActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      hapticTabSwitch();
                      if (isSelected) {
                        setSelectedQuickTags(selectedQuickTags.filter((t) => t !== tag));
                      } else {
                        setSelectedQuickTags([...selectedQuickTags, tag]);
                        if (!isLoggingInspection) {
                          setIsLoggingInspection(true);
                        }
                      }
                    }}
                  >
                    <IOSIcon
                      name={isSelected ? 'check' : 'plus'}
                      size={12}
                      color={isSelected ? '#0F172A' : '#64748B'}
                    />
                    <Text style={[styles.quickTagText, isSelected && styles.quickTagTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Inspection Action Form */}
          {isLoggingInspection ? (
            <View style={styles.inspectionFormCard}>
              <Text style={styles.inspectionFormTitle}>
                {t('ui_colonyInspectorModal.log_welfare_inspection_notes')}
              </Text>
              <TextInput
                style={styles.inspectionInput}
                placeholder={t('ui_colonyInspectorModal.optional_field_notes_e_g_food')}
                placeholderTextColor={IOSColors.tertiaryLabel}
                value={inspectionNotes}
                onChangeText={setInspectionNotes}
                multiline
                numberOfLines={3}
              />
              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  style={styles.cancelFormBtn}
                  onPress={() => {
                    hapticButtonPress();
                    setIsLoggingInspection(false);
                    setSelectedQuickTags([]);
                  }}
                >
                  <Text style={styles.cancelFormBtnText} numberOfLines={1} ellipsizeMode="tail">
                    {t('ui_colonyInspectorModal.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.submitInspectionBtn}
                  onPress={handleConfirmInspection}
                >
                  <IOSIcon name="check" size={16} color="#FFFFFF" />
                  <Text
                    style={styles.submitInspectionBtnText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {t('ui_colonyInspectorModal.save_10_xp')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                hapticButtonPress();
                setIsLoggingInspection(true);
              }}
              activeOpacity={0.8}
            >
              <IOSIcon name="shield" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>
                {t('ui_colonyInspectorModal.log_inspection')}
              </Text>
              <View style={styles.xpPillBadge}>
                <Text style={styles.xpPillBadgeText}>{t('ui_colonyInspectorModal.10_xp')}</Text>
              </View>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  navBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOSColors.systemTeal,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOSColors.label,
  },
  navPlaceholder: {
    width: 48,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  zoneBadgeDog: {
    backgroundColor: '#FFF7ED',
  },
  zoneBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.4,
  },
  zoneBadgeTextDog: {
    color: '#EA580C',
  },
  popBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  popBadgeDog: {
    backgroundColor: '#FFF7ED',
  },
  popBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: IOSColors.systemIndigo,
  },
  popBadgeTextDog: {
    color: '#C2410C',
  },
  colonyName: {
    fontSize: 20,
    fontWeight: '800',
    color: IOSColors.label,
    letterSpacing: -0.4,
  },
  colonyNameAr: {
    fontSize: 14,
    color: IOSColors.secondaryLabel,
    marginTop: 3,
  },
  coordsText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: IOSColors.tertiaryLabel,
    marginTop: 8,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOSColors.label,
  },
  tnrPercentText: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  tnrStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  tnrStatsText: {
    fontSize: 12,
    color: IOSColors.secondaryLabel,
  },
  tnrTargetText: {
    fontSize: 11,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
  },
  facilityGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  facilityPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 38,
  },
  facilityPillWaterActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#BAE6FD',
  },
  facilityPillShelterActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  facilityPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    flexShrink: 1,
  },
  facilityPillTextWaterActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  facilityPillTextShelterActive: {
    color: '#059669',
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: IOSColors.label,
    maxWidth: '60%',
    textAlign: 'right',
  },
  notesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  notesText: {
    fontSize: 12,
    color: IOSColors.secondaryLabel,
    lineHeight: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7C3AED',
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  xpPillBadge: {
    backgroundColor: '#D9F944',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  xpPillBadgeText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  inspectionFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7C3AED',
  },
  inspectionFormTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 8,
  },
  inspectionInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: IOSColors.label,
    minHeight: 70,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelFormBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelFormBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
  },
  submitInspectionBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 46,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
  },
  submitInspectionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  territoryMapSnippet: {
    marginTop: 12,
    height: 110,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  territoryMapImage: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  territoryMapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 10,
  },
  territoryRadarCircle: {
    alignSelf: 'center',
    marginTop: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D9F944',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  territoryRadarPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(217, 249, 68, 0.35)',
  },
  territoryInfoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  territoryPinBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D9F944',
  },
  territoryPinText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#D9F944',
  },
  territoryRadiusPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  territoryRadiusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  quickTagsSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  quickTagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  quickTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickTagPillActive: {
    backgroundColor: '#D9F944',
    borderColor: '#0F172A',
  },
  quickTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickTagTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
