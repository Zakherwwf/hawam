import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  TouchableOpacity,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SurveyProtocol, Species } from '@tunisia-survey/shared';
import { IOSColors, IOSTypography, IOSLayout } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSGroupedList,
  IOSListRow,
  IOSSegmentedControl,
  IOSButton,
} from '../components/ios';

interface StructuredSurveyScreenProps {
  onBack: () => void;
  onFinishSurvey: (sessionData: any) => void;
  onLogAnimal: (animalData: any) => void;
  loggedAnimalsCount: number;
}

export const StructuredSurveyScreen: React.FC<StructuredSurveyScreenProps> = ({
  onBack,
  onFinishSurvey,
  onLogAnimal,
  loggedAnimalsCount,
}) => {
  const { t } = useTranslation();

  const [protocol, setProtocol] = useState<SurveyProtocol>('transect');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [isSurveyActive, setIsSurveyActive] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0.0);

  // In-session animal logging sheet
  const [isLoggingAnimal, setIsLoggingAnimal] = useState<boolean>(false);
  const [sightingSpecies, setSightingSpecies] = useState<Species>('cat');
  const [groupSize, setGroupSize] = useState<number>(1);
  const [distanceFromPathM, setDistanceFromPathM] = useState<string>('5.0');

  // eBird Complete Checklist modal
  const [showEndModal, setShowEndModal] = useState<boolean>(false);

  useEffect(() => {
    let timer: any;
    if (isSurveyActive) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        if (protocol === 'transect') {
          setDistanceKm((prev) => prev + 0.0012);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSurveyActive, protocol]);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStart = () => {
    setIsSurveyActive(true);
    setElapsedSeconds(0);
    setDistanceKm(0.0);
  };

  const handleAddSighting = () => {
    onLogAnimal({
      species: sightingSpecies,
      group_size: groupSize,
      distance_from_path_m: parseFloat(distanceFromPathM) || 0,
      protocol,
      observed_at: new Date().toISOString(),
    });
    setIsLoggingAnimal(false);
    setDistanceFromPathM('5.0');
    setGroupSize(1);
  };

  const confirmEnd = (completeChecklist: boolean) => {
    setShowEndModal(false);
    setIsSurveyActive(false);
    onFinishSurvey({
      protocol,
      route_id: selectedRoute,
      duration_min: parseFloat((elapsedSeconds / 60).toFixed(2)),
      distance_km: parseFloat(distanceKm.toFixed(3)),
      complete_session: completeChecklist,
      number_of_observers: 1,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <IOSNavigationBar
        title={isSurveyActive ? 'Enquête en cours' : t('survey.mode_title')}
        onBack={!isSurveyActive ? onBack : undefined}
        backTitle="Accueil"
      />

      {!isSurveyActive ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Protocol Selection Group */}
          <IOSGroupedList
            header={t('survey.protocol_label')}
            footer="Le transect permet d'estimer la densité par échantillonnage des distances; le point fixe mesure le taux de détection stationnaire."
          >
            <View style={styles.protocolPickerContainer}>
              <IOSSegmentedControl<SurveyProtocol>
                selectedValue={protocol}
                onValueChange={setProtocol}
                values={[
                  { label: '🚶 ' + t('survey.transect'), value: 'transect' },
                  { label: '📍 ' + t('survey.stationary'), value: 'stationary_point' },
                ]}
              />
            </View>
          </IOSGroupedList>

          {/* Fixed Predefined Routes */}
          <IOSGroupedList
            header={t('survey.fixed_route')}
            footer="Les itinéraires fixes permettent de répéter les inventaires sur les mêmes secteurs pour les modèles de dynamique temporelle."
          >
            <IOSListRow
              title="🗺️ Nouvel itinéraire libre"
              subtitle="Tracé GPS libre et découverte de secteur"
              onPress={() => setSelectedRoute(null)}
              rightComponent={selectedRoute === null ? <Text style={styles.checkmark}>✓</Text> : null}
            />
            <IOSListRow
              title="📍 Tunis Médina - Bab Souika"
              subtitle="1.8 km • Urbain dense / Marché"
              onPress={() => setSelectedRoute('route-medina-01')}
              rightComponent={selectedRoute === 'route-medina-01' ? <Text style={styles.checkmark}>✓</Text> : null}
            />
            <IOSListRow
              title="📍 Ariana Centre - Av. Habib Bourguiba"
              subtitle="2.2 km • Résidentiel et commercial"
              isLast
              onPress={() => setSelectedRoute('route-ariana-02')}
              rightComponent={selectedRoute === 'route-ariana-02' ? <Text style={styles.checkmark}>✓</Text> : null}
            />
          </IOSGroupedList>

          <View style={styles.actionContainer}>
            <IOSButton title="Démarrer l'enregistrement GPS" onPress={handleStart} />
          </View>
        </ScrollView>
      ) : (
        /* Active Apple Workout/Fitness HUD */
        <View style={styles.hudContainer}>
          <View style={styles.hudBeacon}>
            <View style={styles.pulseDot} />
            <Text style={styles.beaconText}>ENREGISTREMENT GPS DU TRAJET EN COURS</Text>
          </View>

          <View style={styles.metricsCard}>
            <Text style={styles.primaryMetricVal}>{formatTimer(elapsedSeconds)}</Text>
            <Text style={styles.primaryMetricLabel}>DURÉE ÉCOULÉE</Text>

            <View style={styles.secondaryMetricsRow}>
              <View style={styles.secondaryMetricBox}>
                <Text style={styles.secondaryMetricVal}>{distanceKm.toFixed(2)}</Text>
                <Text style={styles.secondaryMetricLabel}>KILOMÈTRES</Text>
              </View>
              <View style={styles.secondaryMetricDivider} />
              <View style={styles.secondaryMetricBox}>
                <Text style={styles.secondaryMetricVal}>{loggedAnimalsCount}</Text>
                <Text style={styles.secondaryMetricLabel}>DÉTECTIONS</Text>
              </View>
            </View>
          </View>

          <View style={styles.hudActions}>
            <IOSButton
              title="+ Noter un animal vu (Distance)"
              onPress={() => setIsLoggingAnimal(true)}
            />
            <IOSButton
              title="⏹ Clôturer l'enquête"
              variant="destructive"
              onPress={() => setShowEndModal(true)}
            />
          </View>
        </View>
      )}

      {/* In-Session Sighting Modal Sheet */}
      <Modal visible={isLoggingAnimal} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContainer}>
            <View style={IOSLayout.sheetHandle} />
            <Text style={styles.sheetTitle}>Enregistrer une détection</Text>

            <View style={{ marginBottom: 16 }}>
              <IOSSegmentedControl<Species>
                selectedValue={sightingSpecies}
                onValueChange={setSightingSpecies}
                values={[
                  { label: '🐱 Chat', value: 'cat' },
                  { label: '🐶 Chien', value: 'dog' },
                ]}
              />
            </View>

            <View style={styles.distanceInputGroup}>
              <Text style={IOSTypography.subheadline}>Distance perpendiculaire du trajet (mètres)</Text>
              <TextInput
                style={styles.distanceInput}
                keyboardType="numeric"
                value={distanceFromPathM}
                onChangeText={setDistanceFromPathM}
                placeholder="Ex: 8.5"
              />
              <Text style={styles.distanceHelp}>
                Mesure essentielle pour ajuster la fonction de détection g(x) dans Distance Sampling.
              </Text>
            </View>

            <View style={styles.sheetBtnRow}>
              <View style={{ flex: 1 }}>
                <IOSButton
                  title="Annuler"
                  variant="secondary"
                  onPress={() => setIsLoggingAnimal(false)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <IOSButton title="Ajouter" onPress={handleAddSighting} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* eBird Complete Checklist Modal (Non-Detections) */}
      <Modal visible={showEndModal} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertCard}>
            <Text style={styles.alertEmoji}>📋</Text>
            <Text style={styles.alertTitle}>{t('survey.complete_question')}</Text>
            <Text style={styles.alertMessage}>{t('survey.complete_explanation')}</Text>

            <View style={styles.alertBtnStack}>
              <IOSButton
                title={t('survey.yes_complete')}
                onPress={() => confirmEnd(true)}
              />
              <IOSButton
                title={t('survey.no_incomplete')}
                variant="secondary"
                onPress={() => confirmEnd(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  protocolPickerContainer: {
    padding: 16,
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    color: IOSColors.systemTeal,
  },
  actionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  hudContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-between',
  },
  hudBeacon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: IOSColors.systemRed,
  },
  beaconText: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.systemRed,
    letterSpacing: 0.5,
  },
  metricsCard: {
    backgroundColor: IOSColors.secondarySystemGroupedBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.12)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryMetricVal: {
    fontSize: 54,
    fontWeight: '800',
    color: IOSColors.systemTeal,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  primaryMetricLabel: {
    ...IOSTypography.caption1,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.8,
    marginBottom: 20,
  },
  secondaryMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  secondaryMetricBox: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryMetricVal: {
    fontSize: 26,
    fontWeight: '800',
    color: IOSColors.label,
  },
  secondaryMetricLabel: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  secondaryMetricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 30,
    backgroundColor: IOSColors.separator,
  },
  hudActions: {
    gap: 12,
    marginBottom: 16,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: IOSColors.systemBackground,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  sheetTitle: {
    ...IOSTypography.title3,
    textAlign: 'center',
    marginBottom: 16,
  },
  distanceInputGroup: {
    backgroundColor: IOSColors.systemGray6,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  distanceInput: {
    fontSize: 24,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: IOSColors.systemTeal,
  },
  distanceHelp: {
    ...IOSTypography.caption1,
    color: IOSColors.secondaryLabel,
    marginTop: 6,
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  alertEmoji: {
    fontSize: 38,
    marginBottom: 10,
  },
  alertTitle: {
    ...IOSTypography.headline,
    textAlign: 'center',
    marginBottom: 8,
  },
  alertMessage: {
    ...IOSTypography.footnote,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  alertBtnStack: {
    width: '100%',
    gap: 10,
  },
});
