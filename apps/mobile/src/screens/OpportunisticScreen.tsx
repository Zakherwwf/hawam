import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
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
import { IOSColors, IOSTypography } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSGroupedList,
  IOSListRow,
  IOSSegmentedControl,
  IOSButton,
} from '../components/ios';

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
    <SafeAreaView style={styles.safeArea}>
      <IOSNavigationBar
        title={t('nav.opportunistic')}
        onBack={onBack}
        backTitle="Annuler"
        rightAction={
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.saveActionText}>Enregistrer</Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photo Capture Inset Group */}
        <IOSGroupedList header="Photos pour identification individuelle">
          <IOSListRow
            title={t('photo.guided_title')}
            subtitle={
              capturedPhotosCount > 0
                ? `${capturedPhotosCount} angle(s) prêt(s) • Flancs & Face`
                : 'Flanc gauche, flanc droit, face'
            }
            icon="📷"
            iconColor={IOSColors.systemTeal}
            showDisclosure
            value={capturedPhotosCount > 0 ? `✓ ${capturedPhotosCount}` : 'À prendre'}
            isLast
            onPress={onOpenPhotoCapture}
          />
        </IOSGroupedList>

        {/* Taxon & Group Size Group */}
        <IOSGroupedList header="Taxon & Comptage">
          <View style={styles.segmentRow}>
            <Text style={IOSTypography.subheadline}>Espèce</Text>
            <View style={{ width: 200 }}>
              <IOSSegmentedControl<Species>
                selectedValue={species}
                onValueChange={setSpecies}
                values={[
                  { label: '🐱 Chat', value: 'cat' },
                  { label: '🐶 Chien', value: 'dog' },
                ]}
              />
            </View>
          </View>

          <View style={[styles.segmentRow, styles.topDivider]}>
            <Text style={IOSTypography.subheadline}>Taille du groupe</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                onPress={() => setGroupSize(Math.max(1, groupSize - 1))}
                style={styles.stepperBtn}
              >
                <Text style={styles.stepperSign}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperVal}>{groupSize}</Text>
              <TouchableOpacity
                onPress={() => setGroupSize(groupSize + 1)}
                style={styles.stepperBtn}
              >
                <Text style={styles.stepperSign}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </IOSGroupedList>

        {/* ICAM Body Condition Score (1 to 5) */}
        <IOSGroupedList
          header="Score corporel (Échelle visuelle ICAM)"
          footer="L'indice corporel permet d'évaluer le bien-être de la population errante selon les critères validés de l'ICAM."
        >
          <View style={styles.bcsContainer}>
            <IOSSegmentedControl<BodyConditionScore>
              selectedValue={bcs}
              onValueChange={setBcs}
              values={[
                { label: '1', value: 1 },
                { label: '2', value: 2 },
                { label: '3', value: 3 },
                { label: '4', value: 4 },
                { label: '5', value: 5 },
              ]}
            />
            <View style={styles.bcsDescriptionBadge}>
              <Text style={styles.bcsDescriptionText}>{t(`animal.bcs_${bcs}`)}</Text>
            </View>
          </View>
        </IOSGroupedList>

        {/* Demographics & Reproduction */}
        <IOSGroupedList header="Démographie & Stérilisation">
          <View style={styles.segmentRow}>
            <Text style={IOSTypography.subheadline}>Sexe</Text>
            <View style={{ width: 220 }}>
              <IOSSegmentedControl<Sex>
                selectedValue={sex}
                onValueChange={setSex}
                values={[
                  { label: 'Mâle', value: 'male' },
                  { label: 'Femelle', value: 'female' },
                  { label: 'Inconnu', value: 'unknown' },
                ]}
              />
            </View>
          </View>

          <View style={[styles.segmentRow, styles.topDivider]}>
            <Text style={IOSTypography.subheadline}>Stérilisation (TNR)</Text>
            <View style={{ width: 200 }}>
              <IOSSegmentedControl<YesNoUnknown>
                selectedValue={earTip}
                onValueChange={setEarTip}
                values={[
                  { label: 'Entaillée', value: 'yes' },
                  { label: 'Non', value: 'no' },
                  { label: '?', value: 'unknown' },
                ]}
              />
            </View>
          </View>

          <View style={[styles.segmentRow, styles.topDivider]}>
            <Text style={IOSTypography.subheadline}>Reproduction</Text>
            <View style={{ width: 220 }}>
              <IOSSegmentedControl<ReproductiveStatus>
                selectedValue={reproductiveStatus}
                onValueChange={setReproductiveStatus}
                values={[
                  { label: 'Aucun', value: 'none_visible' },
                  { label: 'Allaitante', value: 'lactating' },
                  { label: 'Gestante', value: 'visibly_pregnant' },
                ]}
              />
            </View>
          </View>
        </IOSGroupedList>

        {/* Visible Health Symptoms */}
        <IOSGroupedList header="Santé & Symptômes visibles">
          {[
            { key: 'none' as HealthIssue, label: t('animal.health_none') },
            { key: 'skin_lesions_mange' as HealthIssue, label: t('animal.health_skin') },
            { key: 'wound' as HealthIssue, label: t('animal.health_wound') },
            { key: 'limp' as HealthIssue, label: t('animal.health_limp') },
            { key: 'eye_nose_discharge' as HealthIssue, label: t('animal.health_discharge') },
          ].map((item, idx, arr) => {
            const isChecked = healthIssues.includes(item.key);
            return (
              <IOSListRow
                key={item.key}
                title={item.label}
                onPress={() => toggleHealthIssue(item.key)}
                rightComponent={
                  isChecked ? (
                    <Text style={styles.checkmarkIcon}>✓</Text>
                  ) : null
                }
                isLast={idx === arr.length - 1}
              />
            );
          })}
        </IOSGroupedList>

        {/* Notes */}
        <IOSGroupedList header="Notes de terrain">
          <View style={styles.notesContainer}>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Remarques spécifiques, comportement, couleur du pelage..."
              placeholderTextColor={IOSColors.tertiaryLabel}
              multiline
            />
          </View>
        </IOSGroupedList>

        {/* Bottom Save Action */}
        <View style={styles.bottomBtnContainer}>
          <IOSButton title="Enregistrer l'observation" onPress={handleSave} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  scrollContent: {
    paddingVertical: 16,
  },
  saveActionText: {
    ...IOSTypography.headline,
    color: IOSColors.systemTeal,
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  topDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
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
  stepperSign: {
    fontSize: 18,
    fontWeight: '600',
    color: IOSColors.label,
  },
  stepperVal: {
    ...IOSTypography.headline,
    minWidth: 26,
    textAlign: 'center',
  },
  bcsContainer: {
    padding: 16,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    gap: 12,
  },
  bcsDescriptionBadge: {
    backgroundColor: 'rgba(48, 176, 199, 0.10)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bcsDescriptionText: {
    ...IOSTypography.subheadline,
    color: IOSColors.systemTeal,
    fontWeight: '600',
  },
  checkmarkIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  notesContainer: {
    padding: 12,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  notesInput: {
    ...IOSTypography.body,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  bottomBtnContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 32,
  },
});
