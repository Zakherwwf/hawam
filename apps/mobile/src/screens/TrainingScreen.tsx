import React, { useState } from 'react';
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
      title: 'Effort & Search Pace',
      icon: 'compass',
      subtitle: 'Scientific density modeling requires constant, standardized observer effort.',
      keyConcepts: [
        'Maintain a steady walking pace (~3.0 to 4.0 km/h) along the entire transect.',
        'Keep GPS active continuously; start and end times record the exact survey duration.',
        'Never deviate off-trail to search behind bushes or inside private properties.',
      ],
      referenceGuide: [
        { label: 'Recommended Speed', value: '3.0 – 4.0 km/h' },
        { label: 'GPS Accuracy Threshold', value: '< 20 meters' },
        { label: 'Minimum Transect Length', value: '1.0 km' },
      ],
      quiz: {
        question: 'Why must surveyors maintain a consistent walking pace without searching off-trail?',
        options: [
          'To maximize the sheer quantity of animals spotted in the neighborhood',
          'To ensure standardized observer effort per unit of distance for statistical density estimation',
          'To minimize mobile phone battery consumption during GPS tracking',
        ],
        correctIndex: 1,
        explanation:
          'Consistent pace standardizes the detection probability function g(x) across time and space, allowing statistical models to extrapolate true population size.',
      },
    },
    {
      id: 'distance',
      title: 'Perpendicular Distance',
      icon: 'ruler',
      subtitle: 'Distance Sampling relies on the 90° perpendicular offset from the transect line.',
      keyConcepts: [
        'Perpendicular distance is the shortest distance from the centerline to the initial animal location.',
        'Record the animal location at the exact instant of first detection, before it moves.',
        'Detection directly on the centerline is assumed to be certain: g(0) = 1.0.',
      ],
      referenceGuide: [
        { label: '1 Standard Car Length', value: '≈ 4.0 – 4.5 m' },
        { label: '1 Urban Shop Frontage', value: '≈ 8.0 – 10.0 m' },
        { label: '1 Multi-Story Building', value: '≈ 15.0 – 20.0 m' },
      ],
      quiz: {
        question: 'Which distance measurement is mathematically required for Distance Sampling models?',
        options: [
          'The straight-line diagonal distance from the observer when first spotted',
          'The 90-degree perpendicular distance from the transect path centerline to the animal',
          'The distance the animal runs away after noticing the observer',
        ],
        correctIndex: 1,
        explanation:
          'Distance Sampling specifically integrates the perpendicular distance distribution to model how detection probability decays away from the line.',
      },
    },
    {
      id: 'condition',
      title: 'ICAM Body Condition Scoring',
      icon: 'paw',
      subtitle: 'A validated 5-point visual scale assessing animal nutritional and welfare state.',
      keyConcepts: [
        'Score 1 (Emaciated): Ribs, lumbar vertebrae, and pelvic bones visibly prominent.',
        'Score 2 (Thin): Ribs easily visible; distinct waist hourglass silhouette.',
        'Score 3 (Ideal): Ribs easily palpable with light fat cover; well-proportioned body.',
        'Score 4 (Overweight): Heavy fat cover along lumbar vertebrae and base of tail.',
        'Score 5 (Obese): Distended abdomen with heavy subcutaneous fat deposits.',
      ],
      referenceGuide: [
        { label: 'Score 1', value: 'Emaciated (Severe Rib Prominence)' },
        { label: 'Score 2', value: 'Thin (Visible Waist & Ribs)' },
        { label: 'Score 3', value: 'Ideal (Well-Balanced Silhouette)' },
        { label: 'Score 4/5', value: 'Overweight / Obese' },
      ],
      quiz: {
        question: 'An adult dog has easily visible ribs and an hourglass waist, but lumbar spine bones do not severely protrude. What is the ICAM score?',
        options: [
          'Score 1 (Emaciated)',
          'Score 2 (Thin)',
          'Score 3 (Ideal)',
        ],
        correctIndex: 1,
        explanation:
          'Score 2 indicates a thin animal with easily visible ribs and waist indentation, without the severe muscle wasting and bone protrusion of Score 1.',
      },
    },
    {
      id: 'photos',
      title: 'Photographic Mark-Resight',
      icon: 'camera',
      subtitle: 'Individual identification requires capturing unique, asymmetric coat patterns.',
      keyConcepts: [
        'Left and right flanks of cats and dogs have distinct pigmentation patterns.',
        'A full ID set requires 3 standardized angles: Left Flank, Right Flank, and Face.',
        'Note ear-tipping: a straight horizontal tip notch on the left ear indicates a sterilized animal (TNR).',
      ],
      referenceGuide: [
        { label: 'Angle 1', value: 'Left Flank (Lateral Profile)' },
        { label: 'Angle 2', value: 'Right Flank (Lateral Profile)' },
        { label: 'Angle 3', value: 'Frontal Face (Facial Mask & Whiskers)' },
        { label: 'TNR Mark', value: 'Ear-Tip Notch (Sterilized)' },
      ],
      quiz: {
        question: 'Why is a single flank photograph often insufficient for capture-recapture re-identification?',
        options: [
          'Because coat pigmentation and tabby stripes are asymmetric between left and right sides',
          'Because the camera sensor cannot process colors from only one perspective',
          'Because free-roaming animals change coat color seasonally',
        ],
        correctIndex: 0,
        explanation:
          'Mammalian coat patterns develop through complex embryological migration, creating unique asymmetric patterns on either side. Both flanks are needed to confirm matches from any angle.',
      },
    },
    {
      id: 'zerodata',
      title: 'Complete Checklists & Non-Detections',
      icon: 'check',
      subtitle: 'In population ecology, recording zero animals is just as valuable as recording fifty.',
      keyConcepts: [
        'If you walk 2 km along a transect and spot zero animals, never discard the survey!',
        'Confirm "Yes" on the final complete checklist: you searched and saw zero animals.',
        'Non-detection data is the mathematical foundation for Occupancy and N-mixture models.',
      ],
      referenceGuide: [
        { label: 'eBird Standard', value: 'Every complete search recorded' },
        { label: 'Reward', value: 'Full completion XP awarded for zero counts' },
        { label: 'Badge', value: 'Unlocks the Zero Hero badge' },
      ],
      quiz: {
        question: 'You walked a 2.5 km transect for 40 minutes and saw zero cats and zero dogs. What should you do?',
        options: [
          'Delete the session because an empty survey contains no useful data',
          'Invent at least one sighting nearby to ensure you earn experience points',
          'Save the session and confirm "Yes" to the complete checklist (Non-detection)',
        ],
        correctIndex: 2,
        explanation:
          'Non-detections establish the absence probability in statistical models. In Hawem, complete zero-count surveys receive full effort XP (+20 XP completion bonus) with zero penalty.',
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
          title="Field Academy Certificate"
          onBack={handleBack}
          backTitle={t('nav.profile')}
        />

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Certificate Card */}
          <View style={styles.certCard}>
            <View style={styles.certBadgeCircle}>
              <IOSIcon name="paw" size={40} color={IOSColors.systemTeal} />
            </View>

            <Text style={styles.certSuperTitle}>REPUBLIC OF TUNISIA</Text>
            <Text style={styles.certTitle}>Certified Field Surveyor</Text>
            <Text style={styles.certSubtitle}>
              Fauna Observatory • Free-Roaming Animal Population Research
            </Text>

            <View style={styles.certDivider} />

            <Text style={styles.certBody}>
              This credential certifies that the surveyor has demonstrated complete competency in standardized
              transect pacing, perpendicular distance sampling estimation, ICAM body condition scoring, and eBird
              complete checklist non-detection protocols.
            </Text>

            <View style={styles.certMetaRow}>
              <View style={styles.certMetaItem}>
                <Text style={styles.certMetaLabel}>Credential</Text>
                <Text style={styles.certMetaValue}>Trained Surveyor</Text>
              </View>
              <View style={styles.certMetaItem}>
                <Text style={styles.certMetaLabel}>XP Award</Text>
                <Text style={styles.certMetaValue}>+25 XP Awarded</Text>
              </View>
              <View style={styles.certMetaItem}>
                <Text style={styles.certMetaLabel}>Badge</Text>
                <Text style={styles.certMetaValue}>Academy Graduate</Text>
              </View>
            </View>
          </View>

          <View style={{ marginTop: 24 }}>
            <IOSButton
              title="Return to Profile"
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
        title={`Field Academy (${currentStep + 1}/5)`}
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
          <Text style={styles.sectionHeader}>Core Protocol Standards</Text>
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
            <Text style={styles.sectionHeader}>Field Reference Standards</Text>
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
            <Text style={styles.quizHeader}>Competency Verification Quiz</Text>
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
                    <Text style={styles.optionLetter}>
                      {String.fromCharCode(65 + optIdx)}
                    </Text>
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
                  ? 'Correct Assessment'
                  : 'Needs Review'}
              </Text>
              <Text style={styles.feedbackExplanation}>
                {currentModule.quiz.explanation}
              </Text>
            </View>
          )}
        </View>

        {/* Navigation Actions */}
        <View style={styles.actionRow}>
          {currentStep > 0 && (
            <View style={{ flex: 1, marginRight: 8 }}>
              <IOSButton
                title="Previous"
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
                    ? 'View Certificate'
                    : 'Finish Quiz'
                  : isCurrentQuizAnswered
                  ? 'Next Module'
                  : 'Continue'
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
    color: IOSColors.systemGreen,
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
