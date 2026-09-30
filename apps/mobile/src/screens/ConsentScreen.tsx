import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius, touchTargets } from '@tunisia-survey/design-tokens';
import { Icon } from '../components/design-system/Icon';
import { Button } from '../components/design-system/Button';
import { IOSSegmentedControl } from '../components/ios';
import { hapticTabSwitch, hapticButtonPress, hapticSuccess } from '../utils/haptics';

// v2.0: consent text no longer names a country or partner institution;
// everyone re-accepts once so what they agreed to matches what they read.
export const CURRENT_CONSENT_VERSION = 'v2.0';

interface ConsentScreenProps {
  onAccept: (version: string) => void;
  onLanguageChange: (lang: 'ar' | 'fr' | 'en') => void;
}

type OnboardingStep = 0 | 1 | 2 | 3;

export const ConsentScreen: React.FC<ConsentScreenProps> = ({ onAccept, onLanguageChange }) => {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(0);
  const [agreed, setAgreed] = useState(false);

  // Permission statuses
  const [fgLocationStatus, setFgLocationStatus] = useState<'undetermined' | 'granted' | 'denied'>(
    'undetermined'
  );
  const [bgLocationStatus, setBgLocationStatus] = useState<'undetermined' | 'granted' | 'denied'>(
    'undetermined'
  );
  const [cameraStatus, setCameraStatus] = useState<'undetermined' | 'granted' | 'denied'>(
    'undetermined'
  );
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  // Check existing permissions on mount
  useEffect(() => {
    let isMounted = true;
    const checkPermissions = async () => {
      try {
        const fg = await Location.getForegroundPermissionsAsync();
        if (isMounted)
          setFgLocationStatus(fg.granted ? 'granted' : fg.canAskAgain ? 'undetermined' : 'denied');

        const bg = await Location.getBackgroundPermissionsAsync();
        if (isMounted)
          setBgLocationStatus(bg.granted ? 'granted' : bg.canAskAgain ? 'undetermined' : 'denied');

        const cam = await ImagePicker.getCameraPermissionsAsync();
        if (isMounted)
          setCameraStatus(cam.granted ? 'granted' : cam.canAskAgain ? 'undetermined' : 'denied');
      } catch {
        // Fallback for mock environments
      }
    };
    checkPermissions();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRequestAllPermissions = async () => {
    hapticButtonPress();
    setIsRequestingPermissions(true);
    try {
      // 1. Foreground location
      const fgResult = await Location.requestForegroundPermissionsAsync();
      setFgLocationStatus(fgResult.granted ? 'granted' : 'denied');

      // 2. Background location (only if foreground granted)
      if (fgResult.granted) {
        try {
          const bgResult = await Location.requestBackgroundPermissionsAsync();
          setBgLocationStatus(bgResult.granted ? 'granted' : 'denied');
        } catch {
          setBgLocationStatus('denied');
        }
      }

      // 3. Camera
      const camResult = await ImagePicker.requestCameraPermissionsAsync();
      setCameraStatus(camResult.granted ? 'granted' : 'denied');
      hapticSuccess();
    } catch {
      // Graceful error handling
    } finally {
      setIsRequestingPermissions(false);
    }
  };

  const handleNextStep = () => {
    hapticButtonPress();
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as OnboardingStep);
    }
  };

  const handlePrevStep = () => {
    hapticButtonPress();
    if (currentStep > 0) {
      setCurrentStep((prev) => (prev - 1) as OnboardingStep);
    }
  };

  const handleFinalAccept = () => {
    if (!agreed) return;
    hapticSuccess();
    onAccept(CURRENT_CONSENT_VERSION);
  };

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        {/* Top Header Bar: Step Indicator & Language Switcher */}
        <View style={styles.topBar}>
          {currentStep > 0 ? (
            <TouchableOpacity
              onPress={handlePrevStep}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={t('ui_consent.back_to_previous_step')}
            >
              <Icon name="chevron-left" size={20} color={colors.light.label} />
              <Text style={styles.backButtonText}>{t('ui_consent.back')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <View style={styles.topRightBadge}>
            <Text style={styles.topRightBadgeText}>{t('ui_consent.hawem_v2_0')}</Text>
          </View>
        </View>

        {/* Step Progress Dots */}
        <View style={styles.progressContainer}>
          {[0, 1, 2, 3].map((stepIdx) => (
            <View
              key={stepIdx}
              style={[
                styles.progressDot,
                stepIdx === currentStep && styles.progressDotActive,
                stepIdx < currentStep && styles.progressDotCompleted,
              ]}
            />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* STEP 0: Scientific Citizen Science Mission */}
          {currentStep === 0 && (
            <View style={styles.stepCard}>
              <View style={styles.heroIconWrapper}>
                <Icon name="shield" size={40} color={colors.light.accent} />
              </View>
              <Text style={styles.stepPill}>{t('ui_consent.fauna_observatory')}</Text>
              <Text style={styles.stepTitle}>{t('ui_consent.scientific_field_monitoring')}</Text>
              <Text style={styles.stepSubtitle}>
                {t('ui_consent.hawem_powers_structured_stray_dog_and')}
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.accent }]}>
                    <Icon name="compass" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.standardized_transects')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.replacing_guesswork_with_calibrated_distance_sam')}
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.success }]}>
                    <Icon name="animals" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.individual_health_welfare')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.observing_body_condition_bcs_1_5')}
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.warning }]}>
                    <Icon name="map" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.evidence_based_policy')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.data_drives_humane_trap_neuter_vaccinate')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* STEP 1: How Transects Work & Negative Evidence */}
          {currentStep === 1 && (
            <View style={styles.stepCard}>
              <View style={styles.heroIconWrapper}>
                <Icon name="survey" size={40} color={colors.light.accent} />
              </View>
              <Text style={styles.stepPill}>{t('ui_consent.sampling_methodology')}</Text>
              <Text style={styles.stepTitle}>{t('ui_consent.how_transect_walks_work')}</Text>
              <Text style={styles.stepSubtitle}>
                {t('ui_consent.scientific_surveys_record_your_track_continuousl')}
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.accent }]}>
                    <Icon name="survey" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.pace_path_continuity')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.walk_at_a_normal_steady_pace')}
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.success }]}>
                    <Icon name="check" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.the_value_of_zero_sightings')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.a_transect_where_you_see_zero')}
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View
                    style={[styles.featureBullet, { backgroundColor: colors.light.labelTertiary }]}
                  >
                    <Icon name="crosshair" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.perpendicular_distance')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.note_how_far_an_animal_is')}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* STEP 2: Transparent Permission Priming */}
          {currentStep === 2 && (
            <View style={styles.stepCard}>
              <View style={styles.heroIconWrapper}>
                <Icon name="settings" size={40} color={colors.light.accent} />
              </View>
              <Text style={styles.stepPill}>{t('ui_consent.sensor_access')}</Text>
              <Text style={styles.stepTitle}>{t('ui_consent.device_permissions')}</Text>
              <Text style={styles.stepSubtitle}>
                {t('ui_consent.we_explain_why_each_sensor_is')}
              </Text>

              <View style={styles.permissionList}>
                {/* Foreground Location */}
                <View style={styles.permissionCard}>
                  <View style={styles.permissionIconCol}>
                    <Icon name="compass" size={24} color={colors.light.accent} />
                  </View>
                  <View style={styles.permissionBodyCol}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={styles.permissionTitle}>
                        {t('ui_consent.foreground_location')}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          fgLocationStatus === 'granted'
                            ? styles.statusBadgeGranted
                            : styles.statusBadgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            fgLocationStatus === 'granted'
                              ? styles.statusBadgeTextGranted
                              : styles.statusBadgeTextPending,
                          ]}
                        >
                          {fgLocationStatus === 'granted'
                            ? t('ui_consent.granted')
                            : t('ui_consent.required')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.permissionText}>
                      {t('ui_consent.records_gps_track_points_and_calculates')}
                    </Text>
                  </View>
                </View>

                {/* Background Location */}
                <View style={styles.permissionCard}>
                  <View style={styles.permissionIconCol}>
                    <Icon name="map" size={24} color={colors.light.accent} />
                  </View>
                  <View style={styles.permissionBodyCol}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={styles.permissionTitle}>
                        {t('ui_consent.background_location')}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          bgLocationStatus === 'granted'
                            ? styles.statusBadgeGranted
                            : styles.statusBadgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            bgLocationStatus === 'granted'
                              ? styles.statusBadgeTextGranted
                              : styles.statusBadgeTextPending,
                          ]}
                        >
                          {bgLocationStatus === 'granted'
                            ? t('ui_consent.granted')
                            : t('ui_consent.recommended')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.permissionText}>
                      {t('ui_consent.keeps_recording_your_transect_line_even')}
                    </Text>
                  </View>
                </View>

                {/* Camera */}
                <View style={styles.permissionCard}>
                  <View style={styles.permissionIconCol}>
                    <Icon name="camera" size={24} color={colors.light.accent} />
                  </View>
                  <View style={styles.permissionBodyCol}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={styles.permissionTitle}>{t('ui_consent.camera')}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          cameraStatus === 'granted'
                            ? styles.statusBadgeGranted
                            : styles.statusBadgePending,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            cameraStatus === 'granted'
                              ? styles.statusBadgeTextGranted
                              : styles.statusBadgeTextPending,
                          ]}
                        >
                          {cameraStatus === 'granted'
                            ? t('ui_consent.granted')
                            : t('ui_consent.required')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.permissionText}>
                      {t('ui_consent.allows_capturing_flank_and_face_photographs')}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.grantButton}
                onPress={handleRequestAllPermissions}
                disabled={isRequestingPermissions}
                activeOpacity={0.8}
              >
                <Icon name="check" size={18} color="#FFFFFF" />
                <Text style={styles.grantButtonText}>
                  {isRequestingPermissions
                    ? t('ui_consent.requesting_permissions')
                    : t('ui_consent.grant_device_permissions')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 3: Surveyor Ethical Charter & Versioned Consent */}
          {currentStep === 3 && (
            <View style={styles.stepCard}>
              <View style={styles.heroIconWrapper}>
                <Icon name="award" size={40} color={colors.light.accent} />
              </View>
              <Text style={styles.stepPill}>
                {t('ui_consent.protocol_charter', { CURRENT_CONSENT_VERSION })}
              </Text>
              <Text style={styles.stepTitle}>{t('ui_consent.surveyor_code_of_conduct')}</Text>
              <Text style={styles.stepSubtitle}>
                {t('ui_consent.observing_free_roaming_animals_requires_adherenc')}
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.accent }]}>
                    <Icon name="shield" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.absolute_geodata_protection')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.high_resolution_coordinates_are_strictly_confide')}
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.success }]}>
                    <Icon name="animals" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.non_invasive_observation')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.never_chase_corner_corner_or_handle')}
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View
                    style={[styles.featureBullet, { backgroundColor: colors.light.labelTertiary }]}
                  >
                    <Icon name="user" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>
                      {t('ui_consent.human_privacy_safety')}
                    </Text>
                    <Text style={styles.featureDescription}>
                      {t('ui_consent.never_photograph_bystanders_private_properties_o')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Agreement Switch Box */}
              <TouchableOpacity
                style={styles.agreementBox}
                onPress={() => {
                  hapticButtonPress();
                  setAgreed(!agreed);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.checkboxIndicator, agreed && styles.checkboxIndicatorActive]}>
                  {agreed && <Icon name="check" size={16} color="#FFFFFF" />}
                </View>
                <Text style={styles.agreementText}>
                  {t('ui_consent.i_accept_the_scientific_ethics_charter', {
                    CURRENT_CONSENT_VERSION,
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action Footer */}
        <View style={styles.bottomFooter}>
          {currentStep < 3 ? (
            <Button
              title={t('ui_consent.continue')}
              variant="primary"
              size="lg"
              onPress={handleNextStep}
            />
          ) : (
            <Button
              title={t('ui_consent.accept_charter_start')}
              variant="primary"
              size="lg"
              disabled={!agreed}
              onPress={handleFinalAccept}
            />
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#FAF5EE',
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    minHeight: touchTargets.min,
    minWidth: 60,
  },
  backButtonText: {
    fontSize: typography.body.fontSize,
    color: colors.light.label,
    fontWeight: '500',
  },
  backPlaceholder: {
    minWidth: 60,
  },
  topRightBadge: {
    backgroundColor: 'rgba(230, 81, 0, 0.1)',
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  topRightBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.light.accent,
    letterSpacing: 0.8,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[2],
  },
  progressDot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
  },
  progressDotActive: {
    backgroundColor: colors.light.accent,
    width: 36,
  },
  progressDotCompleted: {
    backgroundColor: colors.light.success,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: spacing[6],
  },
  stepCard: {
    alignItems: 'center',
  },
  heroIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(230, 81, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[3],
  },
  stepPill: {
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    color: colors.light.accent,
    letterSpacing: 1.2,
    marginBottom: spacing[1],
  },
  stepTitle: {
    fontSize: typography.title1.fontSize,
    fontWeight: '700',
    color: colors.light.label,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  stepSubtitle: {
    fontSize: typography.callout.fontSize,
    color: colors.light.labelSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing[5],
    paddingHorizontal: spacing[2],
  },
  featureList: {
    width: '100%',
    gap: spacing[4],
    marginBottom: spacing[5],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  featureBullet: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureDetails: {
    flex: 1,
  },
  featureHeading: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.light.label,
    marginBottom: spacing[1],
  },
  featureDescription: {
    fontSize: typography.subhead.fontSize,
    color: colors.light.labelSecondary,
    lineHeight: 20,
  },
  permissionList: {
    width: '100%',
    gap: spacing[3],
    marginBottom: spacing[4],
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  permissionIconCol: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(230, 81, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  permissionBodyCol: {
    flex: 1,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[1],
  },
  permissionTitle: {
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
    color: colors.light.label,
  },
  permissionText: {
    fontSize: typography.subhead.fontSize,
    color: colors.light.labelSecondary,
    lineHeight: 19,
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  statusBadgeGranted: {
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(230, 81, 0, 0.12)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusBadgeTextGranted: {
    color: colors.light.success,
  },
  statusBadgeTextPending: {
    color: colors.light.accent,
  },
  grantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: colors.light.accent,
    width: '100%',
    minHeight: touchTargets.min,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
  },
  grantButtonText: {
    color: '#FFFFFF',
    fontSize: typography.headline.fontSize,
    fontWeight: '600',
  },
  agreementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: 'rgba(230, 81, 0, 0.2)',
    width: '100%',
    marginBottom: spacing[4],
  },
  checkboxIndicator: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.light.labelTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxIndicatorActive: {
    backgroundColor: colors.light.accent,
    borderColor: colors.light.accent,
  },
  agreementText: {
    flex: 1,
    fontSize: typography.subhead.fontSize,
    color: colors.light.label,
    lineHeight: 20,
    fontWeight: '500',
  },
  bottomFooter: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
    backgroundColor: 'rgba(250, 245, 238, 0.95)',
  },
});
