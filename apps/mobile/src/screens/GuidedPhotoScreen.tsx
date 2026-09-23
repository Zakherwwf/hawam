import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { PhotoAngle, CoatPattern } from '@tunisia-survey/shared';
import { IOSColors, IOSTypography } from '../theme/ios';

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

  const handleSnap = () => {
    const uri = `file:///photos/animal_${activeAngle}_${Date.now()}.jpg`;
    setCapturedPhotos((prev) => ({ ...prev, [activeAngle]: uri }));
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleSkip = () => {
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleComplete = () => {
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
    <SafeAreaView style={styles.cameraContainer}>
      {/* Top Controls Chrome */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.topBarAction}>Annuler</Text>
        </TouchableOpacity>

        <View style={styles.stepCapsules}>
          {angles.map((ang, idx) => {
            const isDone = !!capturedPhotos[ang];
            const isCurrent = idx === currentStep;
            return (
              <TouchableOpacity
                key={ang}
                onPress={() => setCurrentStep(idx as 0 | 1 | 2)}
                style={[styles.stepDot, isCurrent && styles.stepDotActive]}
              >
                <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextActive]}>
                  {idx + 1} {isDone ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={handleComplete}>
          <Text style={[styles.topBarAction, styles.topBarActionDone]}>OK</Text>
        </TouchableOpacity>
      </View>

      {/* Target Angle Instruction Pill */}
      <View style={styles.targetBanner}>
        <Text style={styles.targetText}>
          {activeAngle === 'left_flank'
            ? '🎯 Cadrer le FLANC GAUCHE (asymétrique)'
            : activeAngle === 'right_flank'
            ? '🎯 Cadrer le FLANC DROIT'
            : '🎯 Cadrer la FACE (yeux & museau)'}
        </Text>
      </View>

      {/* Viewfinder Window with Apple Camera Framing Brackets */}
      <View style={styles.viewfinderWrapper}>
        <View style={styles.viewfinderBox}>
          {/* Yellow Framing Corner Accents */}
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />

          {capturedPhotos[activeAngle] ? (
            <View style={styles.photoCapturedPill}>
              <Text style={styles.photoCapturedText}>Photo capturée ✓</Text>
            </View>
          ) : (
            <Text style={styles.viewfinderHelp}>
              Gardez l'animal dans le cadre. Évitez les mouvements brusques.
            </Text>
          )}
        </View>

        {/* Quality Banner */}
        {qualityWarning ? (
          <View style={styles.qualityWarningPill}>
            <Text style={styles.qualityWarningText}>⚠️ {t(qualityWarning)}</Text>
          </View>
        ) : null}
      </View>

      {/* Coat Pattern Horizontal Selector */}
      <View style={styles.patternBar}>
        <Text style={styles.patternLabel}>{t('photo.coat_pattern')} :</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.patternScroll}>
          {coatPatterns.map((pat) => (
            <TouchableOpacity
              key={pat.key}
              onPress={() => setSelectedPattern(pat.key)}
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

        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => setQualityWarning((prev) => (prev ? null : 'photo.quality_warning_blur'))}
        >
          <Text style={styles.testBlurText}>Simuler flou</Text>
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
    fontWeight: '600',
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
  targetText: {
    ...IOSTypography.subheadline,
    color: IOSColors.systemYellow,
    fontWeight: '600',
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
  photoCapturedPill: {
    backgroundColor: IOSColors.systemGreen,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  photoCapturedText: {
    ...IOSTypography.headline,
    color: '#FFFFFF',
  },
  qualityWarningPill: {
    position: 'absolute',
    bottom: 16,
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
  testBlurText: {
    ...IOSTypography.caption2,
    color: 'rgba(255,255,255,0.4)',
  },
});
