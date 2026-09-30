import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSNavigationBar, IOSButton, IOSIcon, IconName } from '../components/ios';
import { useGamificationStore } from '../features/gamification/gamificationStore';
import {
  hapticButtonPress,
  hapticSuccess,
  hapticWarning,
  hapticModalClose,
} from '../utils/haptics';

interface TrainingScreenProps {
  onBack: () => void;
}

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface TrainingModule {
  id: string;
  title: string;
  icon: IconName;
  subtitle: string;
  keyConcepts: string[];
  referenceGuide?: { label: string; value: string }[];
  quiz: QuizQuestion;
}

export const TrainingScreen: React.FC<TrainingScreenProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { isAcademyCertified, completeAcademyCertification } = useGamificationStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean[]>(new Array(5).fill(false));
  const [showCertificate, setShowCertificate] = useState(isAcademyCertified);

  const modules: TrainingModule[] = [
    {
      id: 'pace',
      title: t('ui_training.effort_search_pace'),
      icon: 'compass',
      subtitle: t('ui_training.scientific_density_modeling_requires_constant_st'),
      keyConcepts: [
        t('ui_training.maintain_a_steady_walking_pace_3'),
        t('ui_training.keep_gps_active_continuously_start_and'),
        t('ui_training.never_deviate_off_trail_to_search'),
      ],
      referenceGuide: [
        { label: t('ui_training.recommended_speed'), value: t('ui_training.3_0_4_0_km_h') },
        { label: t('ui_training.gps_accuracy_threshold'), value: t('ui_training.20_meters') },
        { label: t('ui_training.minimum_transect_length'), value: t('ui_training.1_0_km') },
      ],
      quiz: {
        question: t('ui_training.why_must_surveyors_maintain_a_consistent'),
        options: [
          t('ui_training.to_maximize_the_sheer_quantity_of'),
          t('ui_training.to_ensure_standardized_observer_effort_per'),
          t('ui_training.to_minimize_mobile_phone_battery_consumption'),
        ],
        correctIndex: 1,
        explanation: t('ui_training.consistent_pace_standardizes_the_detection_proba'),
      },
    },
    {
      id: 'distance',
      title: t('ui_training.perpendicular_distance'),
      icon: 'ruler',
      subtitle: t('ui_training.distance_sampling_relies_on_the_90'),
      keyConcepts: [
        t('ui_training.perpendicular_distance_is_the_shortest_distance'),
        t('ui_training.record_the_animal_location_at_the'),
        t('ui_training.detection_directly_on_the_centerline_is'),
      ],
      referenceGuide: [
        { label: t('ui_training.1_standard_car_length'), value: '≈ 4.0-4.5 m' },
        { label: t('ui_training.1_urban_shop_frontage'), value: '≈ 8.0-10.0 m' },
        { label: t('ui_training.1_multi_story_building'), value: '≈ 15.0-20.0 m' },
      ],
      quiz: {
        question: t('ui_training.which_distance_measurement_is_mathematically_req'),
        options: [
          t('ui_training.the_straight_line_diagonal_distance_from'),
          t('ui_training.the_90_degree_perpendicular_distance_from'),
          t('ui_training.the_distance_the_animal_runs_away'),
        ],
        correctIndex: 1,
        explanation: t('ui_training.distance_sampling_specifically_integrates_the_pe'),
      },
    },
    {
      id: 'condition',
      title: t('ui_training.icam_body_condition_scoring'),
      icon: 'paw',
      subtitle: t('ui_training.a_validated_5_point_visual_scale'),
      keyConcepts: [
        t('ui_training.score_1_emaciated_ribs_lumbar_vertebrae'),
        t('ui_training.score_2_thin_ribs_easily_visible'),
        t('ui_training.score_3_ideal_ribs_easily_palpable'),
        t('ui_training.score_4_overweight_heavy_fat_cover'),
        t('ui_training.score_5_obese_distended_abdomen_with'),
      ],
      referenceGuide: [
        {
          label: t('ui_training.score_1'),
          value: t('ui_training.emaciated_severe_rib_prominence'),
        },
        { label: t('ui_training.score_2'), value: t('ui_training.thin_visible_waist_ribs') },
        { label: t('ui_training.score_3'), value: t('ui_training.ideal_well_balanced_silhouette') },
        { label: t('ui_training.score_4_5'), value: t('ui_training.overweight_obese') },
      ],
      quiz: {
        question: t('ui_training.an_adult_dog_has_easily_visible'),
        options: [
          t('ui_training.score_1_emaciated'),
          t('ui_training.score_2_thin'),
          t('ui_training.score_3_ideal'),
        ],
        correctIndex: 1,
        explanation: t('ui_training.score_2_indicates_a_thin_animal'),
      },
    },
    {
      id: 'photos',
      title: t('ui_training.photographic_mark_resight'),
      icon: 'camera',
      subtitle: t('ui_training.individual_identification_requires_capturing_uni'),
      keyConcepts: [
        t('ui_training.left_and_right_flanks_of_cats'),
        t('ui_training.a_full_id_set_requires_3'),
        t('ui_training.note_ear_tipping_a_straight_horizontal'),
      ],
      referenceGuide: [
        { label: t('ui_training.angle_1'), value: t('ui_training.left_flank_lateral_profile') },
        { label: t('ui_training.angle_2'), value: t('ui_training.right_flank_lateral_profile') },
        {
          label: t('ui_training.angle_3'),
          value: t('ui_training.frontal_face_facial_mask_whiskers'),
        },
        { label: t('ui_training.tnr_mark'), value: t('ui_training.ear_tip_notch_sterilized') },
      ],
      quiz: {
        question: t('ui_training.why_is_a_single_flank_photograph'),
        options: [
          t('ui_training.because_coat_pigmentation_and_tabby_stripes'),
          t('ui_training.because_the_camera_sensor_cannot_process'),
          t('ui_training.because_free_roaming_animals_change_coat'),
        ],
        correctIndex: 0,
        explanation: t('ui_training.mammalian_coat_patterns_develop_through_complex'),
      },
    },
    {
      id: 'zerodata',
      title: t('ui_training.complete_checklists_non_detections'),
      icon: 'check',
      subtitle: t('ui_training.in_population_ecology_recording_zero_animals'),
      keyConcepts: [
        t('ui_training.if_you_walk_2_km_along'),
        t('ui_training.confirm_yes_on_the_final_complete'),
        t('ui_training.non_detection_data_is_the_mathematical'),
      ],
      referenceGuide: [
        {
          label: t('ui_training.ebird_standard'),
          value: t('ui_training.every_complete_search_recorded'),
        },
        {
          label: t('ui_training.reward'),
          value: t('ui_training.full_completion_xp_awarded_for_zero'),
        },
        { label: t('ui_training.badge'), value: t('ui_training.unlocks_the_zero_hero_badge') },
      ],
      quiz: {
        question: t('ui_training.you_walked_a_2_5_km'),
        options: [
          t('ui_training.delete_the_session_because_an_empty'),
          t('ui_training.invent_at_least_one_sighting_nearby'),
          t('ui_training.save_the_session_and_confirm_yes'),
        ],
        correctIndex: 2,
        explanation: t('ui_training.non_detections_establish_the_absence_probability'),
      },
    },
  ];

  const currentModule = modules[currentStep];
  const isCurrentQuizAnswered = answeredCorrectly[currentStep];

  const handleSelectOption = (index: number) => {
    if (isCurrentQuizAnswered) return;
    setSelectedAnswer(index);

    if (index === currentModule.quiz.correctIndex) {
      hapticSuccess();
      const updated = [...answeredCorrectly];
      updated[currentStep] = true;
      setAnsweredCorrectly(updated);

      // Check if all 5 completed
      if (updated.every((val) => val)) {
        completeAcademyCertification();
        setTimeout(() => {
          hapticSuccess();
          setShowCertificate(true);
        }, 700);
      }
    } else {
      hapticWarning();
    }
  };

  const handleNext = () => {
    hapticButtonPress();
    if (currentStep < modules.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      setShowCertificate(true);
    }
  };

  const handlePrevious = () => {
    hapticButtonPress();
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setSelectedAnswer(null);
    }
  };

  const handleBack = () => {
    hapticModalClose();
    onBack();
  };

  if (showCertificate) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <IOSNavigationBar
          title={t('ui_training.field_academy_certificate')}
          onBack={handleBack}
          backTitle={t('nav.profile')}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Certificate Card */}
          <View style={styles.certCard}>
            <View style={styles.certBadgeCircle}>
              <IOSIcon name="paw" size={40} color={IOSColors.systemTeal} />
            </View>

            <Text style={styles.certSuperTitle}>{t('ui_training.republic_of_tunisia')}</Text>
            <Text style={styles.certTitle}>{t('ui_training.certified_field_surveyor')}</Text>
            <Text style={styles.certSubtitle}>
              {t('ui_training.fauna_observatory_free_roaming_animal_population')}
            </Text>

            <View style={styles.certDivider} />

            <Text style={styles.certBody}>
              {t('ui_training.this_credential_certifies_that_the_surveyor')}
            </Text>

            <View style={styles.certMetaRow}>
              <View style={styles.certMetaItem}>
                <Text style={styles.certMetaLabel}>{t('ui_training.credential')}</Text>
                <Text style={styles.certMetaValue}>{t('ui_training.trained_surveyor')}</Text>
              </View>
              <View style={styles.certMetaItem}>
                <Text style={styles.certMetaLabel}>{t('ui_training.xp_award')}</Text>
                <Text style={styles.certMetaValue}>{t('ui_training.25_xp_awarded')}</Text>
              </View>
              <View style={styles.certMetaItem}>
                <Text style={styles.certMetaLabel}>{t('ui_training.badge')}</Text>
                <Text style={styles.certMetaValue}>{t('ui_training.academy_graduate')}</Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 24 }}>
            <IOSButton
              title={t('ui_training.return_to_profile')}
              variant="primary"
              onPress={handleBack}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <IOSNavigationBar
        title={t('ui_training.field_academy_5', { v0: currentStep + 1 })}
        onBack={handleBack}
        backTitle={t('nav.profile')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step Capsule Progress Bar */}
        <View style={styles.stepCapsulesRow}>
          {modules.map((m, idx) => (
            <TouchableOpacity
              key={m.id}
              style={[
                styles.stepCapsule,
                idx === currentStep && styles.stepCapsuleActive,
                answeredCorrectly[idx] && styles.stepCapsuleCompleted,
              ]}
              onPress={() => {
                hapticButtonPress();
                setCurrentStep(idx);
                setSelectedAnswer(null);
              }}
            >
              <Text
                style={[
                  styles.stepCapsuleText,
                  idx === currentStep && styles.stepCapsuleTextActive,
                ]}
              >
                {idx + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>
            <IOSIcon name={currentModule.icon} size={28} color={IOSColors.systemTeal} />
          </View>
          <Text style={styles.heroTitle}>{currentModule.title}</Text>
          <Text style={styles.heroSubtitle}>{currentModule.subtitle}</Text>
        </View>

        {/* Scientific Concepts List */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>{t('ui_training.core_protocol_standards')}</Text>
          {currentModule.keyConcepts.map((concept, index) => (
            <View key={index} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{concept}</Text>
            </View>
          ))}
        </View>

        {/* Field Reference Metric Guide */}
        {currentModule.referenceGuide && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>{t('ui_training.field_reference_standards')}</Text>
            <View style={styles.refGrid}>
              {currentModule.referenceGuide.map((ref, idx) => (
                <View key={idx} style={styles.refItem}>
                  <Text style={styles.refLabel}>{ref.label}</Text>
                  <Text style={styles.refValue}>{ref.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Interactive Knowledge Check Card */}
        <View style={styles.quizCard}>
          <View style={styles.quizHeaderRow}>
            <IOSIcon name="shield" size={16} color={IOSColors.systemTeal} />
            <Text style={styles.quizHeader}>{t('ui_training.competency_verification_quiz')}</Text>
          </View>

          <Text style={styles.quizQuestion}>{currentModule.quiz.question}</Text>

          <View style={styles.optionsList}>
            {currentModule.quiz.options.map((opt, optIdx) => {
              const isSelected = selectedAnswer === optIdx;
              const isCorrect = optIdx === currentModule.quiz.correctIndex;
              const showResult = isCurrentQuizAnswered || isSelected;

              let cardStyle: any = styles.optionItem;
              let textStyle: any = styles.optionText;

              if (showResult && isCorrect) {
                cardStyle = styles.optionItemCorrect;
                textStyle = styles.optionTextCorrect;
              } else if (showResult && isSelected && !isCorrect) {
                cardStyle = styles.optionItemIncorrect;
                textStyle = styles.optionTextIncorrect;
              }

              return (
                <TouchableOpacity
                  key={optIdx}
                  style={cardStyle}
                  onPress={() => handleSelectOption(optIdx)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLetterBox}>
                    <Text style={styles.optionLetter}>{String.fromCharCode(65 + optIdx)}</Text>
                  </View>
                  <Text style={textStyle}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Feedback Explanation */}
          {selectedAnswer !== null && (
            <View
              style={[
                styles.feedbackBox,
                selectedAnswer === currentModule.quiz.correctIndex
                  ? styles.feedbackBoxCorrect
                  : styles.feedbackBoxIncorrect,
              ]}
            >
              <Text style={styles.feedbackTitle}>
                {selectedAnswer === currentModule.quiz.correctIndex
                  ? t('ui_training.correct_assessment')
                  : t('ui_training.needs_review')}
              </Text>
              <Text style={styles.feedbackExplanation}>{currentModule.quiz.explanation}</Text>
            </View>
          )}
        </View>

        {/* Navigation Actions */}
        <View style={styles.actionRow}>
          {currentStep > 0 && (
            <View style={{ flex: 1, marginRight: 8 }}>
              <IOSButton
                title={t('ui_training.previous')}
                variant="secondary"
                onPress={handlePrevious}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <IOSButton
              title={
                currentStep === modules.length - 1
                  ? isCurrentQuizAnswered
                    ? t('ui_training.view_certificate')
                    : t('ui_training.finish_quiz')
                  : isCurrentQuizAnswered
                    ? t('ui_training.next_module')
                    : t('ui_training.continue')
              }
              variant="primary"
              disabled={!isCurrentQuizAnswered}
              onPress={handleNext}
            />
          </View>
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
    padding: 16,
    paddingBottom: 40,
  },
  stepCapsulesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  stepCapsule: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCapsuleActive: {
    borderColor: IOSColors.systemTeal,
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
  },
  stepCapsuleCompleted: {
    backgroundColor: IOSColors.systemTeal,
    borderColor: IOSColors.systemTeal,
  },
  stepCapsuleText: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
  },
  stepCapsuleTextActive: {
    color: IOSColors.systemTeal,
  },
  heroCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(48, 176, 199, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    ...IOSTypography.title2,
    fontWeight: '800',
    color: IOSColors.label,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroSubtitle: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  sectionHeader: {
    ...IOSTypography.headline,
    color: IOSColors.label,
    fontWeight: '700',
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOSColors.systemTeal,
    marginTop: 7,
    marginRight: 10,
  },
  bulletText: {
    ...IOSTypography.body,
    fontSize: 14,
    lineHeight: 20,
    color: IOSColors.label,
    flex: 1,
  },
  refGrid: {
    gap: 8,
  },
  refItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IOSColors.separator,
  },
  refLabel: {
    ...IOSTypography.subheadline,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
  },
  refValue: {
    ...IOSTypography.subheadline,
    fontWeight: '700',
    color: IOSColors.label,
  },
  quizCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(48, 176, 199, 0.3)',
  },
  quizHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  quizHeader: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quizQuestion: {
    ...IOSTypography.headline,
    color: IOSColors.label,
    fontWeight: '700',
    marginBottom: 14,
    lineHeight: 22,
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: 1,
    borderColor: IOSColors.separator,
  },
  optionItemCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderWidth: 1.5,
    borderColor: IOSColors.systemGreen,
  },
  optionItemIncorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
    borderWidth: 1.5,
    borderColor: IOSColors.systemRed,
  },
  optionLetterBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionLetter: {
    ...IOSTypography.caption2,
    fontWeight: '800',
    color: IOSColors.label,
  },
  optionText: {
    ...IOSTypography.subheadline,
    color: IOSColors.label,
    flex: 1,
    lineHeight: 18,
  },
  optionTextCorrect: {
    ...IOSTypography.subheadline,
    color: IOSColors.successText,
    fontWeight: '700',
    flex: 1,
    lineHeight: 18,
  },
  optionTextIncorrect: {
    ...IOSTypography.subheadline,
    color: IOSColors.systemRed,
    flex: 1,
    lineHeight: 18,
  },
  feedbackBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
  },
  feedbackBoxCorrect: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  feedbackBoxIncorrect: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
  },
  feedbackTitle: {
    ...IOSTypography.caption1,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  feedbackExplanation: {
    ...IOSTypography.caption2,
    color: IOSColors.label,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  certCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: IOSColors.systemTeal,
  },
  certBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(48, 176, 199, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  certSuperTitle: {
    ...IOSTypography.caption2,
    fontWeight: '800',
    color: IOSColors.secondaryLabel,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  certTitle: {
    ...IOSTypography.title1,
    fontWeight: '900',
    color: IOSColors.label,
    marginBottom: 6,
    textAlign: 'center',
  },
  certSubtitle: {
    ...IOSTypography.caption1,
    color: IOSColors.systemTeal,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  certDivider: {
    width: '60%',
    height: 1,
    backgroundColor: IOSColors.separator,
    marginBottom: 16,
  },
  certBody: {
    ...IOSTypography.body,
    fontSize: 14,
    lineHeight: 22,
    color: IOSColors.label,
    textAlign: 'center',
    marginBottom: 20,
  },
  certMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  certMetaItem: {
    alignItems: 'center',
  },
  certMetaLabel: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    marginBottom: 4,
  },
  certMetaValue: {
    ...IOSTypography.caption1,
    fontWeight: '800',
    color: IOSColors.systemTeal,
  },
});
