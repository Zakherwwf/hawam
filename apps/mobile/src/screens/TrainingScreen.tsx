/**
 * Training (v3): five short lessons, each with a one-question check. Passing
 * all five marks the volunteer as trained on this phone.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useGamificationStore } from '../features/gamification/gamificationStore';
import { Button, Card, Press, Screen, Symbol, Text, useTheme, type SymbolName } from '../ui';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface TrainingModule {
  id: string;
  title: string;
  icon: SymbolName;
  subtitle: string;
  keyConcepts: string[];
  referenceGuide?: { label: string; value: string }[];
  quiz: QuizQuestion;
}

export const TrainingScreen: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const { isAcademyCertified, completeAcademyCertification } = useGamificationStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean[]>(new Array(5).fill(false));
  const [showCertificate, setShowCertificate] = useState(isAcademyCertified);

  const modules: TrainingModule[] = [
    {
      id: 'pace',
      title: t('ui_training.effort_search_pace'),
      icon: 'walk',
      subtitle: t('ui_training.scientific_density_modeling_requires_constant_st'),
      keyConcepts: [
        t('ui_training.maintain_a_steady_walking_pace_3'),
        t('ui_training.keep_gps_active_continuously_start_and'),
        t('ui_training.never_deviate_off_trail_to_search'),
      ],
      referenceGuide: [
        { label: t('ui_training.recommended_speed'), value: t('ui_training.3_0_4_0_km_h') },
        { label: t('ui_training.gps_accuracy_threshold'), value: t('ui_training_v3.gps_30') },
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
      title: t('ui_training_v3.photo_title'),
      icon: 'camera',
      subtitle: t('ui_training_v3.photo_sub'),
      keyConcepts: [
        t('ui_training_v3.photo_1'),
        t('ui_training_v3.photo_2'),
        t('ui_training.note_ear_tipping_a_straight_horizontal'),
      ],
      referenceGuide: [
        {
          label: t('ui_training_v3.photo_ref_angle'),
          value: t('ui_training_v3.photo_ref_angle_v'),
        },
        {
          label: t('ui_training_v3.photo_ref_count'),
          value: t('ui_training_v3.photo_ref_count_v'),
        },
        { label: t('ui_training.tnr_mark'), value: t('ui_training.ear_tip_notch_sterilized') },
      ],
      quiz: {
        question: t('ui_training_v3.photo_q'),
        options: [
          t('ui_training_v3.photo_q_a'),
          t('ui_training_v3.photo_q_b'),
          t('ui_training_v3.photo_q_c'),
        ],
        correctIndex: 1,
        explanation: t('ui_training_v3.photo_q_expl'),
      },
    },
    {
      id: 'zerodata',
      title: t('ui_training.complete_checklists_non_detections'),
      icon: 'checkCircle',
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
        { label: t('ui_training.badge'), value: t('ui_training_v3.zero_badge') },
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
      const updated = [...answeredCorrectly];
      updated[currentStep] = true;
      setAnsweredCorrectly(updated);

      // Check if all 5 completed
      if (updated.every((val) => val)) {
        completeAcademyCertification();
        setTimeout(() => setShowCertificate(true), 700);
      }
    }
  };

  const handleNext = () => {
    if (currentStep < modules.length - 1) {
      setCurrentStep((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      setShowCertificate(true);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      setSelectedAnswer(null);
    }
  };

  if (showCertificate) {
    return (
      <Screen title={t('ui_training_v3.done_title')} onBack={onBack} inTabs={false}>
        <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              borderWidth: 4,
              borderColor: c.gold,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Symbol name="academy" size={36} color={c.gold} weight="semibold" />
          </View>
          <Text variant="title2" align="center">
            {t('ui_training.certified_field_surveyor')}
          </Text>
          <Text variant="subhead" tone="ink2" align="center">
            {t('ui_training_v3.done_body')}
          </Text>
        </Card>
        <Button
          title={t('ui_training_v3.review')}
          kind="secondary"
          onPress={() => {
            setShowCertificate(false);
            setCurrentStep(0);
            setSelectedAnswer(null);
          }}
          style={{ marginTop: 20 }}
        />
        <Button title={t('ui_training_v3.done')} onPress={onBack} style={{ marginTop: 12 }} />
      </Screen>
    );
  }

  const m = currentModule;
  const last = currentStep === modules.length - 1;
  return (
    <Screen
      title={t('ui_profile.training')}
      subtitle={t('ui_training_v3.lesson', { n: currentStep + 1, total: modules.length })}
      onBack={onBack}
      inTabs={false}
    >
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
        {modules.map((mod, i) => (
          <Press
            key={mod.id}
            haptic={false}
            onPress={() => {
              setCurrentStep(i);
              setSelectedAnswer(null);
            }}
            accessibilityLabel={t('ui_training_v3.lesson', { n: i + 1, total: modules.length })}
            accessibilityState={{ selected: i === currentStep }}
            style={{ flex: 1, height: 44, justifyContent: 'center' }}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: answeredCorrectly[i]
                  ? c.accent
                  : i === currentStep
                    ? c.ink2
                    : c.fill,
              }}
            />
          </Press>
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: c.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name={m.icon} size={24} color={c.accent} weight="semibold" />
        </View>
        <Text variant="title2" style={{ flex: 1 }}>
          {m.title}
        </Text>
      </View>
      <Text variant="body" tone="ink2" style={{ marginBottom: 20 }}>
        {m.subtitle}
      </Text>

      <Card style={{ gap: 12, marginBottom: 16 }}>
        {m.keyConcepts.map((k, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
            <Symbol name="check" size={16} color={c.accent} weight="semibold" />
            <Text variant="subhead" style={{ flex: 1 }}>
              {k}
            </Text>
          </View>
        ))}
      </Card>

      {m.referenceGuide ? (
        <Card padded={false} style={{ marginBottom: 28 }}>
          {m.referenceGuide.map((r, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderTopWidth: i ? 0.5 : 0,
                borderTopColor: c.hairline,
              }}
            >
              <Text variant="subhead" tone="ink2" style={{ flex: 1 }}>
                {r.label}
              </Text>
              <Text variant="subhead" weight="600" style={{ flexShrink: 1, textAlign: 'right' }}>
                {r.value}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Text
        variant="footnote"
        tone="ink2"
        style={{ textTransform: 'uppercase', marginBottom: 8, marginHorizontal: 4 }}
      >
        {t('ui_training_v3.check')}
      </Text>
      <Text variant="headline" style={{ marginBottom: 12 }}>
        {m.quiz.question}
      </Text>
      <View style={{ gap: 10 }}>
        {m.quiz.options.map((opt, i) => {
          const isCorrect = i === m.quiz.correctIndex;
          const show = isCurrentQuizAnswered || selectedAnswer === i;
          const good = show && isCorrect;
          const bad = show && selectedAnswer === i && !isCorrect;
          return (
            <Press
              key={i}
              onPress={() => handleSelectOption(i)}
              accessibilityRole="radio"
              accessibilityState={{ selected: selectedAnswer === i }}
              accessibilityLabel={opt}
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                padding: 14,
                minHeight: 52,
                borderRadius: radius.lg,
                backgroundColor: good ? c.accentSoft : bad ? c.dangerSoft : c.surface,
                borderWidth: 2,
                borderColor: good ? c.accent : bad ? c.danger : 'transparent',
              }}
            >
              <Text
                variant="headline"
                style={{ width: 20, color: good ? c.accent : bad ? c.danger : c.ink3 }}
              >
                {String.fromCharCode(65 + i)}
              </Text>
              <Text
                variant="subhead"
                style={{ flex: 1, color: good ? c.accent : bad ? c.danger : c.ink }}
              >
                {opt}
              </Text>
            </Press>
          );
        })}
      </View>
      {selectedAnswer !== null ? (
        <Card style={{ marginTop: 12, gap: 4 }}>
          <Text
            variant="headline"
            style={{ color: selectedAnswer === m.quiz.correctIndex ? c.accent : c.danger }}
          >
            {selectedAnswer === m.quiz.correctIndex
              ? t('ui_training_v3.right')
              : t('ui_training_v3.try_again')}
          </Text>
          <Text variant="subhead" tone="ink2">
            {m.quiz.explanation}
          </Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        {currentStep > 0 ? (
          <Button
            kind="secondary"
            title={t('ui_training.previous')}
            onPress={handlePrevious}
            style={{ flex: 1 }}
          />
        ) : null}
        <Button
          title={last ? t('ui_training_v3.finish') : t('ui_training.next_module')}
          disabled={!isCurrentQuizAnswered}
          onPress={handleNext}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
};
