import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalProfile } from '../../features/animals/animalsStore';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon } from '../ios';
import { hapticModalClose, hapticButtonPress, hapticQuickLog } from '../../utils/haptics';

interface AnimalDetailModalProps {
  visible: boolean;
  animal: AnimalProfile | null;
  onClose: () => void;
  onLogResighting?: (animal: AnimalProfile) => void;
}

export const AnimalDetailModal: React.FC<AnimalDetailModalProps> = ({
  visible,
  animal,
  onClose,
  onLogResighting,
}) => {
  const { t } = useTranslation();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

  if (!animal) return null;

  const isCat = animal.species === 'cat';
  const primaryThemeColor = isCat ? '#0284C7' : '#D97706';
  const lightThemeBg = isCat ? '#E0F2FE' : '#FEF3C7';

  const handleClose = () => {
    hapticModalClose();
    onClose();
  };

  const handleLog = () => {
    hapticQuickLog();
    if (onLogResighting) {
      onLogResighting(animal);
    }
    onClose();
  };

  const photos = animal.photos || [];
  const activePhoto = photos[selectedPhotoIndex];

  // Calculate days monitored
  const firstSeenDate = new Date(animal.first_seen_at);
  const lastSeenDate = new Date(animal.last_seen_at);
  const diffDays = Math.max(
    1,
    Math.round((lastSeenDate.getTime() - firstSeenDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={handleClose} style={styles.navBtn} activeOpacity={0.7}>
            <Text style={styles.navBtnText}>{t('ui_animalDetailModal.done')}</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>{t('ui_animalDetailModal.animal_dossier')}</Text>
          <View style={styles.idPill}>
            <Text style={styles.idText}>#{animal.id.toUpperCase()}</Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Identity Card */}
          <View style={styles.headerCard}>
            <View style={styles.headerTopRow}>
              <View style={[styles.speciesIconCircle, { backgroundColor: lightThemeBg }]}>
                <Image
                  source={
                    isCat
                      ? require('../../../assets/icon_cat_primary.png')
                      : require('../../../assets/icon_dog_amber.png')
                  }
                  style={styles.speciesIcon}
                  resizeMode="contain"
                />
              </View>

              <View style={styles.badgeRow}>
                {animal.ear_tipped && (
                  <View style={styles.tnrBadge}>
                    <IOSIcon name="shield" size={11} color="#059669" />
                    <Text style={styles.tnrBadgeText}>
                      {t('ui_animalDetailModal.tnr_ear_tipped')}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.idScoreBadge,
                    {
                      backgroundColor:
                        animal.identifiability === 'high'
                          ? 'rgba(2, 132, 199, 0.12)'
                          : 'rgba(100, 116, 139, 0.12)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.idScoreText,
                      { color: animal.identifiability === 'high' ? '#0284C7' : '#64748B' },
                    ]}
                  >
                    {animal.identifiability === 'high'
                      ? t('ui_animalDetailModal.high_id_confidence')
                      : t('ui_animalDetailModal.standard_id')}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.animalNickname}>{animal.nickname}</Text>
            <Text style={styles.animalSubtitle}>
              {isCat
                ? t('ui_animalDetailModal.felis_catus_free_roaming_cat')
                : t('ui_animalDetailModal.canis_familiaris_free_roaming_dog')}
            </Text>

            {/* Photo Showcase Carousel */}
            <View style={styles.photoShowcaseContainer}>
              {photos.length > 0 && activePhoto ? (
                <View style={styles.photoFrame}>
                  <Image
                    source={
                      activePhoto.uri.startsWith('http') || activePhoto.uri.startsWith('file://')
                        ? { uri: activePhoto.uri }
                        : isCat
                          ? require('../../../assets/cat_pose_1_primary.png')
                          : require('../../../assets/dog_pose_1_amber.png')
                    }
                    style={styles.photoHeroImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoAngleBadge}>
                    <IOSIcon name="camera" size={11} color="#FFFFFF" />
                    <Text style={styles.photoAngleText}>
                      {activePhoto.angle.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={[styles.photoFallbackFrame, { backgroundColor: lightThemeBg }]}>
                  <Image
                    source={
                      isCat
                        ? require('../../../assets/cat_pose_2_primary.png')
                        : require('../../../assets/dog_pose_2_amber.png')
                    }
                    style={styles.photoFallbackImage}
                    resizeMode="contain"
                  />
                  <Text style={[styles.photoFallbackText, { color: primaryThemeColor }]}>
                    {t('ui_animalDetailModal.standardized_angle_photographs')}
                  </Text>
                </View>
              )}

              {/* Photo Thumbnails Selector Strip */}
              {photos.length > 1 && (
                <View style={styles.thumbnailStrip}>
                  {photos.map((ph, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.thumbnailPill,
                        selectedPhotoIndex === idx && {
                          borderColor: primaryThemeColor,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => {
                        hapticButtonPress();
                        setSelectedPhotoIndex(idx);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.thumbnailText,
                          selectedPhotoIndex === idx && {
                            color: primaryThemeColor,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {ph.angle.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Mark-Recapture Metrics Bento */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>
              {t('ui_animalDetailModal.mark_resight_telemetry')}
            </Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{animal.sightings_count}</Text>
                <Text style={styles.metricLabel}>{t('ui_animalDetailModal.total_sightings')}</Text>
                <Text style={styles.metricSub}>{t('ui_animalDetailModal.independent_logs')}</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{diffDays}d</Text>
                <Text style={styles.metricLabel}>{t('ui_animalDetailModal.observation_span')}</Text>
                <Text style={styles.metricSub}>{t('ui_animalDetailModal.days_monitored')}</Text>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text
                  style={[styles.metricValue, { color: animal.ear_tipped ? '#059669' : '#D97706' }]}
                >
                  {animal.ear_tipped ? t('ui_animalDetailModal.yes') : t('ui_animalDetailModal.no')}
                </Text>
                <Text style={styles.metricLabel}>{t('ui_animalDetailModal.sterilized')}</Text>
                <Text style={styles.metricSub}>
                  {animal.ear_tipped
                    ? t('ui_animalDetailModal.ear_tipped_tnr')
                    : t('ui_animalDetailModal.intact')}
                </Text>
              </View>
            </View>
          </View>

          {/* Biological Characteristics & Morphology */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>
              {t('ui_animalDetailModal.morphological_characteristics')}
            </Text>

            <View style={styles.charRow}>
              <Text style={styles.charLabel}>{t('ui_animalDetailModal.coat_pattern')}</Text>
              <View style={styles.charValuePill}>
                <Text style={styles.charValueText}>
                  {animal.coat_pattern.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            {animal.primary_colour && (
              <View style={styles.charRow}>
                <Text style={styles.charLabel}>{t('ui_animalDetailModal.coloration')}</Text>
                <Text style={styles.charValuePlain}>{animal.primary_colour}</Text>
              </View>
            )}

            <View style={styles.charRow}>
              <Text style={styles.charLabel}>{t('ui_animalDetailModal.colony_station')}</Text>
              <Text style={styles.charValuePlain}>
                {animal.colony_name || t('ui_animalDetailModal.solitary_free_roaming_hub')}
              </Text>
            </View>

            <View style={styles.charRow}>
              <Text style={styles.charLabel}>{t('ui_animalDetailModal.first_recorded')}</Text>
              <Text style={styles.charValuePlain}>
                {new Date(animal.first_seen_at).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>

            <View style={[styles.charRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.charLabel}>{t('ui_animalDetailModal.last_resighted')}</Text>
              <Text style={styles.charValuePlain}>
                {new Date(animal.last_seen_at).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Geolocation & Home Range Territory */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>
              {t('ui_animalDetailModal.territory_sighting_location')}
            </Text>
            <View style={styles.geoCoordsBar}>
              <IOSIcon name="location" size={13} color="#0284C7" />
              <Text style={styles.geoCoordsText}>
                {animal.latitude.toFixed(5)}° N, {animal.longitude.toFixed(5)}° E
              </Text>
            </View>

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
                      {t('ui_animalDetailModal.frequent_activity_corridor')}
                    </Text>
                  </View>
                  <View style={styles.territoryRadiusPill}>
                    <Text style={styles.territoryRadiusText}>
                      {t('ui_animalDetailModal.est_radius_250m')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Primary Action: Log Resighting */}
          <TouchableOpacity
            style={styles.logResightingBtn}
            onPress={handleLog}
            activeOpacity={0.82}
          >
            <IOSIcon name="camera" size={18} color="#FFFFFF" />
            <Text style={styles.logResightingBtnText} numberOfLines={1} ellipsizeMode="tail">
              {t('ui_animalDetailModal.log_sighting_for', { nickname: animal.nickname })}
            </Text>
            <View style={styles.xpBonusBadge}>
              <Text style={styles.xpBonusBadgeText}>{t('ui_animalDetailModal.10_xp')}</Text>
            </View>
          </TouchableOpacity>
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
    color: '#0F172A',
  },
  idPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  idText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  speciesIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesIcon: {
    width: 28,
    height: 28,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tnrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  tnrBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  idScoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  idScoreText: {
    fontSize: 10,
    fontWeight: '800',
  },
  animalNickname: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  animalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  photoShowcaseContainer: {
    marginTop: 4,
  },
  photoFrame: {
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  photoHeroImage: {
    width: '100%',
    height: '100%',
  },
  photoAngleBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoAngleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  photoFallbackFrame: {
    height: 140,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.2)',
  },
  photoFallbackImage: {
    width: 60,
    height: 60,
  },
  photoFallbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  thumbnailPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  thumbnailText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  metricSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  charLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  charValuePlain: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  charValuePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  charValueText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  geoCoordsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  geoCoordsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0284C7',
    fontVariant: ['tabular-nums'],
  },
  territoryMapSnippet: {
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
    opacity: 0.65,
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
  logResightingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    minHeight: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  logResightingBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  xpBonusBadge: {
    backgroundColor: '#D9F944',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  xpBonusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
});
