import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  I18nManager,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { PhotoAngle, CoatPattern } from '@tunisia-survey/shared';
import { IOSColors, IOSTypography } from '../theme/ios';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSIcon } from '../components/ios';
import { capturePhotoFromCamera, pickPhotoFromLibrary } from '../services/cameraService';
import {
  hapticQuickLog,
  hapticButtonPress,
  hapticSuccess,
  hapticTabSwitch,
  hapticModalClose,
} from '../utils/haptics';

interface CapturedPhotoItem {
  angle: PhotoAngle;
  uri: string;
  coatPattern?: CoatPattern;
}

interface GuidedPhotoScreenProps {
  onBack: () => void;
  onFinishCapture: (photos: CapturedPhotoItem[], coatPattern: CoatPattern) => void;
}

export const GuidedPhotoScreen: React.FC<GuidedPhotoScreenProps> = ({
  onBack,
  onFinishCapture,
}) => {
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);
  const angles: PhotoAngle[] = ['left_flank', 'right_flank', 'face'];
  const [capturedPhotos, setCapturedPhotos] = useState<Record<PhotoAngle, string | null>>({
    left_flank: null,
    right_flank: null,
    face: null,
    other: null,
  });

  const [selectedPattern, setSelectedPattern] = useState<CoatPattern>('tabby');
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);

  const activeAngle = angles[currentStep];

  const handleSnap = async () => {
    hapticQuickLog();
    const photo = await capturePhotoFromCamera();
    if (photo?.uri) {
      hapticSuccess();
      setCapturedPhotos((prev) => ({ ...prev, [activeAngle]: photo.uri }));
      if (currentStep < 2) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2);
      }
    }
  };

  const handlePickFromGallery = async () => {
    hapticButtonPress();
    const photo = await pickPhotoFromLibrary();
    if (photo?.uri) {
      hapticSuccess();
      setCapturedPhotos((prev) => ({ ...prev, [activeAngle]: photo.uri }));
      if (currentStep < 2) {
        setCurrentStep((prev) => (prev + 1) as 1 | 2);
      }
    }
  };

  const handleSkip = () => {
    hapticTabSwitch();
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleComplete = () => {
    hapticSuccess();
    const list: CapturedPhotoItem[] = [];
    for (const angle of angles) {
      const uri = capturedPhotos[angle];
      if (uri) list.push({ angle, uri, coatPattern: selectedPattern });
    }
    onFinishCapture(list, selectedPattern);
  };

  const coatPatterns: Array<{ key: CoatPattern; label: string }> = [
    { key: 'tabby', label: t('photo.pattern_tabby') },
    { key: 'bicolour_piebald', label: t('photo.pattern_bicolour') },
    { key: 'tortoiseshell_calico', label: t('photo.pattern_calico') },
    { key: 'solid_black', label: t('photo.pattern_solid_black') },
    { key: 'solid_other', label: t('photo.pattern_solid_other') },
  ];

  return (
    <SafeAreaView style={styles.cameraContainer} edges={['top', 'left', 'right']}>
      {/* Top Controls Chrome */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            hapticModalClose();
            onBack();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.topBarAction}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <View style={styles.stepCapsules}>
          {angles.map((ang, idx) => {
            const isDone = !!capturedPhotos[ang];
            const isCurrent = idx === currentStep;
            return (
              <TouchableOpacity
                key={ang}
                onPress={() => {
                  hapticButtonPress();
                  setCurrentStep(idx as 0 | 1 | 2);
                }}
                style={[styles.stepDot, isCurrent && styles.stepDotActive]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextActive]}>
                    {t('ui_guidedPhoto.step', { v1: idx + 1 })}
                  </Text>
                  {isDone ? (
                    <IOSIcon name="check" size={12} color={isCurrent ? '#000000' : '#FFFFFF'} />
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={handleComplete}>
          <Text style={[styles.topBarAction, styles.topBarActionDone]}>{t('common.done')}</Text>
        </TouchableOpacity>
      </View>

      {/* Target Angle Instruction Pill */}
      <View style={styles.targetBanner}>
        <View style={styles.targetPill}>
          <IOSIcon name="camera" size={14} color={IOSColors.systemYellow} />
          <Text style={styles.targetText}>
            {activeAngle === 'left_flank'
              ? t('ui_guidedPhoto.frame_left_flank_asymmetric_pattern')
              : activeAngle === 'right_flank'
                ? t('ui_guidedPhoto.frame_right_flank')
                : t('ui_guidedPhoto.frame_face_eyes_nose_markings')}
          </Text>
        </View>
      </View>

      {/* Viewfinder Window with Apple Camera Framing Brackets */}
      <View style={styles.viewfinderWrapper}>
        <View style={styles.viewfinderBox}>
          {capturedPhotos[activeAngle] ? (
            <Image
              source={{ uri: capturedPhotos[activeAngle]! }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : null}

          {/* Yellow Framing Corner Accents */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          {capturedPhotos[activeAngle] ? (
            <View style={styles.capturedOverlayContainer}>
              <View style={styles.photoCapturedPill}>
                <IOSIcon name="check" size={15} color="#FFFFFF" />
                <Text style={styles.photoCapturedText}>{t('ui_guidedPhoto.photo_captured')}</Text>
              </View>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  hapticButtonPress();
                  setCapturedPhotos((prev) => ({ ...prev, [activeAngle]: null }));
                }}
                activeOpacity={0.8}
              >
                <IOSIcon name="camera" size={14} color="#FFFFFF" />
                <Text style={styles.retakeBtnText}>{t('ui_guidedPhoto.retake_angle')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.viewfinderHelp}>
              {t('ui_guidedPhoto.tap_shutter_to_take_photo_or')}
            </Text>
          )}
        </View>

        {/* Quality Banner */}
        {qualityWarning ? (
          <View style={styles.qualityWarningPill}>
            <IOSIcon name="info" size={14} color="#000000" />
            <Text style={styles.qualityWarningText}>{t(qualityWarning)}</Text>
          </View>
        ) : null}
      </View>

      {/* Coat Pattern Horizontal Selector */}
      <View style={styles.patternBar}>
        <Text style={styles.patternLabel}>{t('photo.coat_pattern')}:</Text>
        <View style={styles.scrollWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.patternScroll}
          >
            {coatPatterns.map((pat) => (
              <TouchableOpacity
                key={pat.key}
                onPress={() => {
                  hapticTabSwitch();
                  setSelectedPattern(pat.key);
                }}
                style={[
                  styles.patternPill,
                  selectedPattern === pat.key && styles.patternPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.patternPillText,
                    selectedPattern === pat.key && styles.patternPillTextActive,
                  ]}
                >
                  {pat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.95)', 'rgba(0, 0, 0, 0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fadeLeft}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fadeRight}
            pointerEvents="none"
          />
        </View>
      </View>

      {/* Bottom Shutter Controls */}
      <View style={styles.bottomChrome}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>{t('photo.skip')}</Text>
        </TouchableOpacity>

        {/* Apple Camera Shutter Button */}
        <TouchableOpacity style={styles.shutterOuter} onPress={handleSnap} activeOpacity={0.6}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        {/* Photo Library Picker Button */}
        <TouchableOpacity style={styles.galleryButton} onPress={handlePickFromGallery}>
          <IOSIcon name="photo" size={22} color="#FFFFFF" />
          <Text style={styles.galleryButtonText}>{t('ui_guidedPhoto.library')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  topBarAction: {
    ...IOSTypography.body,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  topBarActionDone: {
    color: IOSColors.systemTeal,
    fontWeight: '700',
  },
  stepCapsules: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 3,
    borderRadius: 20,
  },
  stepDot: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  stepDotActive: {
    backgroundColor: '#FFFFFF',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  stepDotTextActive: {
    color: '#000000',
  },
  targetBanner: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  targetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 204, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  targetText: {
    ...IOSTypography.caption1,
    color: IOSColors.systemYellow,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  viewfinderWrapper: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinderBox: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: IOSColors.systemYellow,
  },
  cornerTL: { top: 16, left: 16, borderTopWidth: 2.5, borderLeftWidth: 2.5 },
  cornerTR: { top: 16, right: 16, borderTopWidth: 2.5, borderRightWidth: 2.5 },
  cornerBL: { bottom: 16, left: 16, borderBottomWidth: 2.5, borderLeftWidth: 2.5 },
  cornerBR: { bottom: 16, right: 16, borderBottomWidth: 2.5, borderRightWidth: 2.5 },
  viewfinderHelp: {
    ...IOSTypography.footnote,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  capturedOverlayContainer: {
    alignItems: 'center',
    gap: 12,
  },
  photoCapturedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IOSColors.systemGreen,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  photoCapturedText: {
    ...IOSTypography.headline,
    color: '#FFFFFF',
    fontSize: 14,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  retakeBtnText: {
    ...IOSTypography.caption1,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  qualityWarningPill: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 204, 0, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  qualityWarningText: {
    ...IOSTypography.caption1,
    color: '#000000',
    fontWeight: '600',
  },
  patternBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  patternLabel: {
    ...IOSTypography.caption1,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  patternScroll: {
    gap: 8,
    paddingHorizontal: 8,
  },
  scrollWrapper: {
    position: 'relative',
  },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 16,
    zIndex: 2,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 16,
    zIndex: 2,
  },
  patternPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  patternPillActive: {
    backgroundColor: IOSColors.systemTeal,
  },
  patternPillText: {
    ...IOSTypography.caption1,
    color: '#FFFFFF',
  },
  patternPillTextActive: {
    fontWeight: '700',
  },
  bottomChrome: {
    height: 110,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    minWidth: 80,
    alignItems: 'center',
  },
  skipText: {
    ...IOSTypography.subheadline,
    color: 'rgba(255,255,255,0.7)',
  },
  galleryButton: {
    minWidth: 80,
    alignItems: 'center',
    gap: 4,
  },
  galleryButtonText: {
    ...IOSTypography.caption2,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },
});
