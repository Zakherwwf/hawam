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

  // Multi-angle workflow steps: left_flank -> right_flank -> face
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);
  const angles: PhotoAngle[] = ['left_flank', 'right_flank', 'face'];
  const [capturedPhotos, setCapturedPhotos] = useState<Record<PhotoAngle, string | null>>({
    left_flank: null,
    right_flank: null,
    face: null,
    other: null,
  });

  const [selectedPattern, setSelectedPattern] = useState<CoatPattern>('tabby');
  const [simulatedQualityWarning, setSimulatedQualityWarning] = useState<string | null>(null);

  const activeAngle = angles[currentStep];

  const handleSimulatedSnap = () => {
    // Save simulated high-res photo URI
    const simulatedUri = `file:///simulated/animal_${activeAngle}_${Date.now()}.jpg`;
    setCapturedPhotos((prev) => ({ ...prev, [activeAngle]: simulatedUri }));

    // Move to next angle or finish
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleSkipAngle = () => {
    // Animal may flee; skipping is allowed per scientific requirements
    if (currentStep < 2) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2);
    }
  };

  const handleComplete = () => {
    const photoList: CapturedPhotoItem[] = [];
    for (const angle of angles) {
      const uri = capturedPhotos[angle];
      if (uri) {
        photoList.push({ angle, uri, coatPattern: selectedPattern });
      }
    }
    onFinishCapture(photoList, selectedPattern);
  };

  const coatPatterns: Array<{ key: CoatPattern; label: string }> = [
    { key: 'tabby', label: t('photo.pattern_tabby') },
    { key: 'bicolour_piebald', label: t('photo.pattern_bicolour') },
    { key: 'tortoiseshell_calico', label: t('photo.pattern_calico') },
    { key: 'solid_black', label: t('photo.pattern_solid_black') },
    { key: 'solid_other', label: t('photo.pattern_solid_other') },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('photo.guided_title')}</Text>
        <TouchableOpacity onPress={handleComplete}>
          <Text style={styles.doneBtnText}>Terminer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          {angles.map((ang, idx) => {
            const isDone = !!capturedPhotos[ang];
            const isCurrent = idx === currentStep;
            return (
              <View key={ang} style={[styles.stepTab, isCurrent && styles.stepTabActive]}>
                <Text style={[styles.stepText, (isCurrent || isDone) && styles.stepTextActive]}>
                  {idx + 1}. {t(`photo.${ang}`)} {isDone ? '✓' : ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Viewfinder Preview Box */}
        <View style={styles.viewfinder}>
          <View style={styles.viewfinderFrame}>
            <Text style={styles.viewfinderTarget}>
              {activeAngle === 'left_flank'
                ? '🎯 Cadrez le flanc GAUCHE entier (du cou à la queue)'
                : activeAngle === 'right_flank'
                ? '🎯 Cadrez le flanc DROIT entier'
                : '🎯 Cadrez la FACE (yeux, front et museau)'}
            </Text>
            {capturedPhotos[activeAngle] && (
              <View style={styles.capturedBadge}>
                <Text style={styles.capturedBadgeText}>Photo capturée !</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quality Warning if applicable */}
        {simulatedQualityWarning && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>⚠️ {t(simulatedQualityWarning)}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkipAngle}>
            <Text style={styles.skipBtnText}>{t('photo.skip')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.snapBtn} onPress={handleSimulatedSnap}>
            <View style={styles.snapInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.simulateTestBtn}
            onPress={() =>
              setSimulatedQualityWarning((prev) =>
                prev ? null : 'photo.quality_warning_blur'
              )
            }
          >
            <Text style={styles.simulateTestText}>Tester flou</Text>
          </TouchableOpacity>
        </View>

        {/* Coat Pattern Quick-Pick */}
        <View style={styles.patternSection}>
          <Text style={styles.patternTitle}>{t('photo.coat_pattern')}</Text>
          <Text style={styles.patternHelp}>
            Les pelages unis (noir uni ou blanc uni) ont une probabilité de ré-identification plus faible.
          </Text>

          <View style={styles.patternGrid}>
            {coatPatterns.map((pat) => (
              <TouchableOpacity
                key={pat.key}
                style={[
                  styles.patternChip,
                  selectedPattern === pat.key && styles.patternChipActive,
                ]}
                onPress={() => setSelectedPattern(pat.key)}
              >
                <Text
                  style={[
                    styles.patternChipText,
                    selectedPattern === pat.key && styles.patternChipTextActive,
                  ]}
                >
                  {pat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Finish Button */}
        <TouchableOpacity style={styles.finishBtn} onPress={handleComplete}>
          <Text style={styles.finishBtnText}>Valider les photos</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#1E293B',
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#F8FAFC' },
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 18, color: '#94A3B8' },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: '#2DD4BF' },
  scroll: { padding: 16, gap: 16 },
  stepIndicator: { flexDirection: 'row', gap: 6 },
  stepTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  stepTabActive: { backgroundColor: '#0F766E' },
  stepText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  stepTextActive: { color: '#FFFFFF', fontWeight: '700' },
  viewfinder: {
    height: 240,
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  viewfinderFrame: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2DD4BF',
    borderRadius: 12,
    width: '85%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  viewfinderTarget: {
    color: '#E2E8F0',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  capturedBadge: {
    position: 'absolute',
    bottom: 12,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  capturedBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  warningBox: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
  },
  warningText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  skipBtnText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  snapBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#94A3B8',
  },
  snapInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0F766E',
  },
  simulateTestBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  simulateTestText: { color: '#64748B', fontSize: 12 },
  patternSection: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 8,
  },
  patternTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  patternHelp: { fontSize: 12, color: '#94A3B8', lineHeight: 16 },
  patternGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  patternChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#334155',
  },
  patternChipActive: { backgroundColor: '#0F766E' },
  patternChipText: { color: '#CBD5E1', fontSize: 12 },
  patternChipTextActive: { color: '#FFFFFF', fontWeight: '700' },
  finishBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  finishBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
