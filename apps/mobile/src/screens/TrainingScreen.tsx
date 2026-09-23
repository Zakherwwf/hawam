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
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Guide Méthodologique ({currentSlide + 1}/5)</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.icon}>{slide.icon}</Text>
          <Text style={styles.title}>{t(slide.titleKey)}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>

          <View style={styles.pointsList}>
            {slide.points.map((pt, idx) => (
              <View key={idx} style={styles.pointRow}>
                <Text style={styles.pointDot}>•</Text>
                <Text style={styles.pointText}>{pt}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Carousel Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, currentSlide === 0 && styles.navBtnDisabled]}
            disabled={currentSlide === 0}
            onPress={() => setCurrentSlide((prev) => prev - 1)}
          >
            <Text style={styles.navBtnText}>Précédent</Text>
          </TouchableOpacity>

          <View style={styles.dotsRow}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentSlide && styles.dotActive]}
              />
            ))}
          </View>

          {currentSlide < slides.length - 1 ? (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnPrimary]}
              onPress={() => setCurrentSlide((prev) => prev + 1)}
            >
              <Text style={styles.navBtnPrimaryText}>Suivant</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.navBtn, styles.navBtnPrimary]}
              onPress={onBack}
            >
              <Text style={styles.navBtnPrimaryText}>Prêt pour le terrain !</Text>
            </TouchableOpacity>
          )}
        </View>
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
  topBarTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 18, color: '#64748B' },
  scroll: { padding: 20, gap: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 14,
  },
  icon: { fontSize: 56, marginBottom: 8 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#0F766E',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  pointsList: { alignSelf: 'stretch', gap: 12, marginTop: 8 },
  pointRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pointDot: { fontSize: 18, color: '#0F766E', lineHeight: 22 },
  pointText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 22 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  navBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  navBtnPrimary: { backgroundColor: '#0F766E' },
  navBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  dotsRow: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CBD5E1' },
  dotActive: { width: 20, backgroundColor: '#0F766E' },
});
