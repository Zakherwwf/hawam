import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, spacing, radius, touchTargets } from '@tunisia-survey/design-tokens';
import { Icon } from '../components/design-system/Icon';
import { Button } from '../components/design-system/Button';
import { IOSSegmentedControl } from '../components/ios';
import {
  hapticTabSwitch,
  hapticButtonPress,
  hapticSuccess,
} from '../utils/haptics';

export const CURRENT_CONSENT_VERSION = 'v1.0-tn-pasteur';

interface ConsentScreenProps {
  onAccept: (version: string) => void;
  onLanguageChange: (lang: 'ar' | 'fr' | 'en') => void;
}

type OnboardingStep = 0 | 1 | 2 | 3;

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  onAccept,
  onLanguageChange,
}) => {
  const { t, i18n } = useTranslation();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(0);
  const [agreed, setAgreed] = useState(false);

  // Permission statuses
  const [fgLocationStatus, setFgLocationStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [bgLocationStatus, setBgLocationStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [cameraStatus, setCameraStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);

  // Check existing permissions on mount
  useEffect(() => {
    let isMounted = true;
    const checkPermissions = async () => {
      try {
        const fg = await Location.getForegroundPermissionsAsync();
        if (isMounted) setFgLocationStatus(fg.granted ? 'granted' : fg.canAskAgain ? 'undetermined' : 'denied');

        const bg = await Location.getBackgroundPermissionsAsync();
        if (isMounted) setBgLocationStatus(bg.granted ? 'granted' : bg.canAskAgain ? 'undetermined' : 'denied');

        const cam = await ImagePicker.getCameraPermissionsAsync();
        if (isMounted) setCameraStatus(cam.granted ? 'granted' : cam.canAskAgain ? 'undetermined' : 'denied');
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
              accessibilityLabel="Back to previous step"
            >
              <Icon name="chevron-left" size={20} color={colors.light.label} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backPlaceholder} />
          )}

          <View style={styles.topRightBadge}>
            <Text style={styles.topRightBadgeText}>HAWEM V2.0</Text>
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
              <Text style={styles.stepPill}>FAUNA OBSERVATORY</Text>
              <Text style={styles.stepTitle}>Scientific Field Monitoring</Text>
              <Text style={styles.stepSubtitle}>
                Hawem powers structured stray dog and cat population surveillance across Tunisia in
                partnership with veterinary researchers and the Pasteur Institute.
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.accent }]}>
                    <Icon name="compass" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Standardized Transects</Text>
                    <Text style={styles.featureDescription}>
                      Replacing guesswork with calibrated distance-sampling walks and reproducible spatial
                      routes.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.success }]}>
                    <Icon name="animals" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Individual Health & Welfare</Text>
                    <Text style={styles.featureDescription}>
                      Observing body condition (BCS 1-5), reproductive status, ear-notches, and rabies
                      vaccination tags.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.warning }]}>
                    <Icon name="map" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Evidence-Based Policy</Text>
                    <Text style={styles.featureDescription}>
                      Data drives humane trap-neuter-vaccinate-return (TNVR) allocation rather than lethal culling.
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
              <Text style={styles.stepPill}>SAMPLING METHODOLOGY</Text>
              <Text style={styles.stepTitle}>How Transect Walks Work</Text>
              <Text style={styles.stepSubtitle}>
                Scientific surveys record your track continuously to estimate total animal density per square
                kilometer.
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.accent }]}>
                    <Icon name="survey" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Pace & Path Continuity</Text>
                    <Text style={styles.featureDescription}>
                      Walk at a normal steady pace (2 to 5 km/h). Avoid lingering in one spot. Speeds above
                      15 km/h are filtered out.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.success }]}>
                    <Icon name="check" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>The Value of Zero Sightings</Text>
                    <Text style={styles.featureDescription}>
                      A transect where you see zero animals is high-value negative evidence. It proves absence in
                      that zone and earns equal scientific XP.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.labelTertiary }]}>
                    <Icon name="crosshair" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Perpendicular Distance</Text>
                    <Text style={styles.featureDescription}>
                      Note how far an animal is from your walk line. Distance modeling mathematically corrects
                      for animals missed further away.
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
              <Text style={styles.stepPill}>SENSOR ACCESS</Text>
              <Text style={styles.stepTitle}>Device Permissions</Text>
              <Text style={styles.stepSubtitle}>
                We explain why each sensor is required before your operating system displays a prompt.
              </Text>

              <View style={styles.permissionList}>
                {/* Foreground Location */}
                <View style={styles.permissionCard}>
                  <View style={styles.permissionIconCol}>
                    <Icon name="compass" size={24} color={colors.light.accent} />
                  </View>
                  <View style={styles.permissionBodyCol}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={styles.permissionTitle}>Foreground Location</Text>
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
                          {fgLocationStatus === 'granted' ? 'GRANTED' : 'REQUIRED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.permissionText}>
                      Records GPS track points and calculates distance and pace while performing transect walks.
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
                      <Text style={styles.permissionTitle}>Background Location</Text>
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
                          {bgLocationStatus === 'granted' ? 'GRANTED' : 'RECOMMENDED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.permissionText}>
                      Keeps recording your transect line even when your phone is locked or screen is off in your
                      pocket.
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
                      <Text style={styles.permissionTitle}>Camera</Text>
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
                          {cameraStatus === 'granted' ? 'GRANTED' : 'REQUIRED'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.permissionText}>
                      Allows capturing flank and face photographs for individual animal re-identification and
                      body scoring.
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
                  {isRequestingPermissions ? 'Requesting Permissions...' : 'Grant Device Permissions'}
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
              <Text style={styles.stepPill}>PROTOCOL CHARTER · {CURRENT_CONSENT_VERSION}</Text>
              <Text style={styles.stepTitle}>Surveyor Code of Conduct</Text>
              <Text style={styles.stepSubtitle}>
                Observing free-roaming animals requires adherence to strict ethics and privacy principles.
              </Text>

              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.accent }]}>
                    <Icon name="shield" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Absolute Geodata Protection</Text>
                    <Text style={styles.featureDescription}>
                      High-resolution coordinates are strictly confidential and never publicly released,
                      preventing municipal culling or poisoning risks. Public maps display only aggregated cells.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.success }]}>
                    <Icon name="animals" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Non-Invasive Observation</Text>
                    <Text style={styles.featureDescription}>
                      Never chase, corner, corner, or handle free-roaming animals. Observe from a calm distance
                      without altering natural behavior.
                    </Text>
                  </View>
                </View>

                <View style={styles.featureItem}>
                  <View style={[styles.featureBullet, { backgroundColor: colors.light.labelTertiary }]}>
                    <Icon name="user" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.featureDetails}>
                    <Text style={styles.featureHeading}>Human Privacy & Safety</Text>
                    <Text style={styles.featureDescription}>
                      Never photograph bystanders, private properties, or license plates. All photos are
                      automatically scrubbed of EXIF metadata before upload.
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
                  I accept the scientific ethics charter, privacy terms, and versioned protocol ({CURRENT_CONSENT_VERSION}).
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Bottom Action Footer */}
        <View style={styles.bottomFooter}>
          {currentStep < 3 ? (
            <Button
              title="Continue"
              variant="primary"
              size="lg"
              onPress={handleNextStep}
            />
          ) : (
            <Button
              title="Accept Charter & Start"
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
