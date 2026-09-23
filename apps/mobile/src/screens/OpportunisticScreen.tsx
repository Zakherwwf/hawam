import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Species,
  Sex,
  AgeClass,
  ReproductiveStatus,
  BodyConditionScore,
  HealthIssue,
  YesNoUnknown,
  AnimalBehaviour,
} from '@tunisia-survey/shared';

interface OpportunisticScreenProps {
  onBack: () => void;
  onOpenPhotoCapture: () => void;
  onSaveObservation: (data: any) => void;
  capturedPhotosCount: number;
}

export const OpportunisticScreen: React.FC<OpportunisticScreenProps> = ({
  onBack,
  onOpenPhotoCapture,
  onSaveObservation,
  capturedPhotosCount,
}) => {
  const { t } = useTranslation();

  const [species, setSpecies] = useState<Species>('cat');
  const [groupSize, setGroupSize] = useState<number>(1);
  const [sex, setSex] = useState<Sex>('unknown');
  const [ageClass, setAgeClass] = useState<AgeClass>('adult');
  const [reproductiveStatus, setReproductiveStatus] = useState<ReproductiveStatus>('none_visible');
  const [bcs, setBcs] = useState<BodyConditionScore>(3);
  const [healthIssues, setHealthIssues] = useState<HealthIssue[]>(['none']);
  const [earTip, setEarTip] = useState<YesNoUnknown>('unknown');
  const [collar, setCollar] = useState<YesNoUnknown>('no');
  const [behaviour, setBehaviour] = useState<AnimalBehaviour>('neutral');
  const [habitat, setHabitat] = useState<string>('residential');
  const [notes, setNotes] = useState<string>('');

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

  const handleSave = () => {
    onSaveObservation({
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
      observed_at: new Date().toISOString(),
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('nav.opportunistic')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Photo Button with Badge */}
        <TouchableOpacity style={styles.photoCaptureCard} onPress={onOpenPhotoCapture}>
          <Text style={styles.photoEmoji}>📷</Text>
          <View style={styles.photoTextCol}>
            <Text style={styles.photoTitle}>{t('photo.guided_title')}</Text>
            <Text style={styles.photoSubtitle}>
              {capturedPhotosCount > 0
                ? `${capturedPhotosCount} photos ready (Flanks + Face)`
                : 'Left flank, right flank, face'}
            </Text>
          </View>
          {capturedPhotosCount > 0 && (
            <View style={styles.photoBadge}>
              <Text style={styles.photoBadgeText}>✓ {capturedPhotosCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Species Pick */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('animal.species')}</Text>
          <View style={styles.toggleRow}>
            {(['cat', 'dog'] as Species[]).map((sp) => (
              <TouchableOpacity
                key={sp}
                style={[styles.toggleBtn, species === sp && styles.toggleBtnActive]}
                onPress={() => setSpecies(sp)}
              >
                <Text style={[styles.toggleBtnText, species === sp && styles.toggleBtnTextActive]}>
                  {sp === 'cat' ? `🐱 ${t('animal.cat')}` : `🐶 ${t('animal.dog')}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Group Size */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('animal.group_size')}</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setGroupSize(Math.max(1, groupSize - 1))}
            >
              <Text style={styles.counterBtnText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.counterVal}>{groupSize}</Text>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => setGroupSize(groupSize + 1)}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ICAM Body Condition Score (1 to 5) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('animal.bcs_title')}</Text>
          <View style={styles.bcsRow}>
            {([1, 2, 3, 4, 5] as BodyConditionScore[]).map((score) => (
              <TouchableOpacity
                key={score}
                style={[styles.bcsBtn, bcs === score && styles.bcsBtnActive]}
                onPress={() => setBcs(score)}
              >
                <Text style={[styles.bcsNum, bcs === score && styles.bcsNumActive]}>{score}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.bcsDescription}>{t(`animal.bcs_${bcs}`)}</Text>
        </View>

        {/* Reproductive Status (ICAM Turnover Indicator) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('animal.reproductive')}</Text>
          <View style={styles.chipRow}>
            {(['none_visible', 'lactating', 'visibly_pregnant'] as ReproductiveStatus[]).map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, reproductiveStatus === r && styles.chipActive]}
                onPress={() => setReproductiveStatus(r)}
              >
                <Text style={[styles.chipText, reproductiveStatus === r && styles.chipTextActive]}>
                  {t(`animal.${r}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Neutering & Ownership Markers */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('animal.ear_tip')}</Text>
          <View style={styles.chipRow}>
            {(['yes', 'no', 'unknown'] as YesNoUnknown[]).map((val) => (
              <TouchableOpacity
                key={val}
                style={[styles.chip, earTip === val && styles.chipActive]}
                onPress={() => setEarTip(val)}
              >
                <Text style={[styles.chipText, earTip === val && styles.chipTextActive]}>
                  {val.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Behaviour */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('animal.behaviour')}</Text>
          <View style={styles.chipRow}>
            {(['approachable', 'neutral', 'fearful', 'aggressive'] as AnimalBehaviour[]).map((b) => (
              <TouchableOpacity
                key={b}
                style={[styles.chip, behaviour === b && styles.chipActive]}
                onPress={() => setBehaviour(b)}
              >
                <Text style={[styles.chipText, behaviour === b && styles.chipTextActive]}>
                  {t(`animal.${b}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <TextInput
            style={styles.textInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="..."
            multiline
          />
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitBtnText}>Enregistrer l'observation</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 18, color: '#64748B' },
  scroll: { padding: 20, gap: 18 },
  photoCaptureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 12,
  },
  photoEmoji: { fontSize: 26 },
  photoTextCol: { flex: 1 },
  photoTitle: { fontSize: 15, fontWeight: '700', color: '#065F46' },
  photoSubtitle: { fontSize: 12, color: '#047857' },
  photoBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  photoBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textAlign: I18nManager.isRTL ? 'right' : 'left',
  },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  toggleBtnText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  toggleBtnTextActive: { color: '#FFFFFF' },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterBtnText: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  counterVal: { fontSize: 20, fontWeight: '800', color: '#0F172A', minWidth: 30, textAlign: 'center' },
  bcsRow: { flexDirection: 'row', gap: 8 },
  bcsBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bcsBtnActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  bcsNum: { fontSize: 16, fontWeight: '700', color: '#475569' },
  bcsNumActive: { color: '#FFFFFF' },
  bcsDescription: { fontSize: 13, color: '#0F766E', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
