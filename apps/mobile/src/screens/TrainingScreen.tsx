import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { IOSColors, IOSTypography } from '../theme/ios';
import { IOSNavigationBar, IOSButton, IOSGroupedList, IOSListRow } from '../components/ios';

interface TrainingScreenProps {
  onBack: () => void;
}

interface TrainingSlide {
  titleKey: string;
  icon: string;
  subtitle: string;
  points: string[];
}

export const TrainingScreen: React.FC<TrainingScreenProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: TrainingSlide[] = [
    {
      titleKey: 'training.screen1_title',
      icon: '🚶',
      subtitle: 'La rigueur scientifique dépend de la mesure exacte de votre effort.',
      points: [
        'Marchez à vitesse régulière et constante (~3 à 4 km/h).',
        'Laissez le GPS actif tout au long de la session pour enregistrer la longueur du transect.',
        'Ne déviez pas excessivement du tracé pour aller chercher des animaux cachés.',
      ],
    },
    {
      titleKey: 'training.screen2_title',
      icon: '📐',
      subtitle: 'La distance perpendiculaire permet de calculer la fonction de détectabilité g(x).',
      points: [
        'Mesurez ou estimez la distance à angle droit entre votre ligne de marche et l\'animal.',
        'La distance au moment où vous apercevez l\'animal pour la première fois est celle qui compte.',
        'Les animaux proches du trajet sont presque toujours vus (g(0)=1); la probabilité diminue avec la distance.',
      ],
    },
    {
      titleKey: 'training.screen3_title',
      icon: '🩺',
      subtitle: 'Échelle visuelle validée ICAM en 5 points pour évaluer le bien-être.',
      points: [
        'Score 1 (Émacié) : Côtes, vertèbres lombaires et os pelviens très saillants.',
        'Score 2 (Mince) : Côtes facilement visibles, taille très marquée.',
        'Score 3 (Idéal) : Côtes palpables sans excès de graisse, silhouette équilibrée.',
        'Score 4 (Surpoids) : Dépôts graisseux sur la colonne et la base de la queue.',
        'Score 5 (Obèse) : Abdomen distendu, dépôts massifs de graisse.',
      ],
    },
    {
      titleKey: 'training.screen4_title',
      icon: '📸',
      subtitle: 'Les motifs des pelages sont asymétriques : photographiez les deux côtés.',
      points: [
        'Le flanc gauche et le flanc droit d\'un chat ou d\'un chien ont des motifs uniques et différents.',
        'Prenez toujours 1 flanc gauche, 1 flanc droit et 1 photo de face.',
        'Rapprochez-vous sans effrayer l\'animal pour éviter les photos floues.',
      ],
    },
    {
      titleKey: 'training.screen5_title',
      icon: '⭕',
      subtitle: 'En science de la conservation, l\'absence est une information capitale !',
      points: [
        'Si vous parcourez un transect de 2 km sans voir un seul chat ou chien, ne jetez pas la session !',
        'Répondez "OUI" à la question finale ("Avez-vous noté tous les animaux ?").',
        'Ces "non-détections" permettent aux modèles statistiques d\'estimer correctement la probabilité d\'occupation.',
      ],
    },
  ];

  const slide = slides[currentSlide];

  return (
    <SafeAreaView style={styles.safeArea}>
      <IOSNavigationBar
        title={`Guide Méthodologique (${currentSlide + 1}/5)`}
        onBack={onBack}
        backTitle="Accueil"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Apple Hero Header Card */}
        <View style={styles.heroCard}>
          <View style={styles.iconCircle}>
            <Text style={styles.heroEmoji}>{slide.icon}</Text>
          </View>
          <Text style={styles.heroTitle}>{t(slide.titleKey)}</Text>
          <Text style={styles.heroSubtitle}>{slide.subtitle}</Text>
        </View>

        {/* Grouped Inset Points */}
        <IOSGroupedList header="Directives de terrain">
          {slide.points.map((pt, idx) => (
            <IOSListRow
              key={idx}
              title={pt}
              icon="✓"
              iconColor={IOSColors.systemTeal}
              isLast={idx === slide.points.length - 1}
            />
          ))}
        </IOSGroupedList>

        {/* iOS UIPageControl Style Pagination Dots */}
        <View style={styles.paginationRow}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.pageDot,
                i === currentSlide && styles.pageDotActive,
              ]}
            />
          ))}
        </View>

        {/* Navigation Action Buttons */}
        <View style={styles.actionRow}>
          {currentSlide > 0 ? (
            <View style={{ flex: 1 }}>
              <IOSButton
                title="Précédent"
                variant="secondary"
                onPress={() => setCurrentSlide((prev) => prev - 1)}
              />
            </View>
          ) : null}

          <View style={{ flex: 1 }}>
            {currentSlide < slides.length - 1 ? (
              <IOSButton
                title="Suivant"
                onPress={() => setCurrentSlide((prev) => prev + 1)}
              />
            ) : (
              <IOSButton
                title="Prêt pour le terrain !"
                onPress={onBack}
              />
            )}
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
    paddingVertical: 16,
  },
  heroCard: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  heroEmoji: {
    fontSize: 36,
  },
  heroTitle: {
    ...IOSTypography.title2,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    ...IOSTypography.subheadline,
    color: IOSColors.systemTeal,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 16,
  },
  pageDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: IOSColors.systemGray4,
  },
  pageDotActive: {
    width: 18,
    backgroundColor: IOSColors.systemTeal,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
});
