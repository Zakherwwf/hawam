import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  Modal,
  I18nManager,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SurveyProtocol, Species } from '@tunisia-survey/shared';

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

  // Session state
  const [protocol, setProtocol] = useState<SurveyProtocol>('transect');
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [isSurveyActive, setIsSurveyActive] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [distanceKm, setDistanceKm] = useState<number>(0.0);
  
  // Animal logging modal within session
  const [isLoggingAnimal, setIsLoggingAnimal] = useState<boolean>(false);
  const [sightingSpecies, setSightingSpecies] = useState<Species>('cat');
  const [groupSize, setGroupSize] = useState<number>(1);
  const [distanceFromPathM, setDistanceFromPathM] = useState<string>('5');

  // Complete checklist end modal (eBird model)
  const [showEndModal, setShowEndModal] = useState<boolean>(false);

  // Timer simulation
  useEffect(() => {
    let timer: any;
    if (isSurveyActive) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
        // Simulate distance accumulation for walking transect
        if (protocol === 'transect') {
          setDistanceKm((prev) => prev + 0.0012); // ~4.3 km/h pace
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSurveyActive, protocol]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartSurvey = () => {
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
    setDistanceFromPathM('5');
    setGroupSize(1);
  };

  const confirmEndSurvey = (completeChecklist: boolean) => {
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
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={isSurveyActive}>
          <Text style={[styles.backBtnText, isSurveyActive && { color: '#CBD5E1' }]}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('survey.mode_title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {!isSurveyActive ? (
          // Pre-Survey Setup Screen
          <View style={styles.setupCard}>
            <Text style={styles.sectionLabel}>{t('survey.protocol_label')}</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.protocolBtn, protocol === 'transect' && styles.protocolBtnActive]}
                onPress={() => setProtocol('transect')}
              >
                <Text style={styles.protocolEmoji}>🚶</Text>
                <Text style={[styles.protocolText, protocol === 'transect' && styles.protocolTextActive]}>
                  {t('survey.transect')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.protocolBtn, protocol === 'stationary_point' && styles.protocolBtnActive]}
                onPress={() => setProtocol('stationary_point')}
              >
                <Text style={styles.protocolEmoji}>📍</Text>
                <Text style={[styles.protocolText, protocol === 'stationary_point' && styles.protocolTextActive]}>
                  {t('survey.stationary')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fixed Predefined Routes */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>{t('survey.fixed_route')}</Text>
            <TouchableOpacity
              style={[styles.routeOption, selectedRoute === null && styles.routeOptionActive]}
              onPress={() => setSelectedRoute(null)}
            >
              <Text style={styles.routeName}>🗺️ {t('survey.no_route')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeOption, selectedRoute === 'route-medina-01' && styles.routeOptionActive]}
              onPress={() => setSelectedRoute('route-medina-01')}
            >
              <Text style={styles.routeName}>📍 Tunis Médina - Circuit Bab Souika (1.8 km)</Text>
              <Text style={styles.routeSub}>Tunis • Urban / Market</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.routeOption, selectedRoute === 'route-ariana-02' && styles.routeOptionActive]}
              onPress={() => setSelectedRoute('route-ariana-02')}
            >
              <Text style={styles.routeName}>📍 Ariana Centre - Avenue Habib Bourguiba (2.2 km)</Text>
              <Text style={styles.routeSub}>Ariana • Residential / Commercial</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.startBtn} onPress={handleStartSurvey}>
              <Text style={styles.startBtnText}>▶ Démarrer le relevé scientifique</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Active Survey HUD
          <View style={styles.hudCard}>
            <View style={styles.liveIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>{t('survey.tracking_active')}</Text>
            </View>

            <View style={styles.hudMetrics}>
              <View style={styles.hudBox}>
                <Text style={styles.hudVal}>{formatTime(elapsedSeconds)}</Text>
                <Text style={styles.hudLabel}>Durée</Text>
              </View>
              <View style={styles.hudDivider} />
              <View style={styles.hudBox}>
                <Text style={styles.hudVal}>{distanceKm.toFixed(2)} km</Text>
                <Text style={styles.hudLabel}>Distance</Text>
              </View>
              <View style={styles.hudDivider} />
              <View style={styles.hudBox}>
                <Text style={styles.hudVal}>{loggedAnimalsCount}</Text>
                <Text style={styles.hudLabel}>Animaux notés</Text>
              </View>
            </View>

            {/* In-Session Animal Record Button */}
            <TouchableOpacity
              style={styles.addAnimalBtn}
              onPress={() => setIsLoggingAnimal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addAnimalBtnText}>+ Noter un animal vu (Distance Sampling)</Text>
            </TouchableOpacity>

            {/* Stop Survey Button */}
            <TouchableOpacity
              style={styles.stopBtn}
              onPress={() => setShowEndModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.stopBtnText}>⏹ {t('survey.stop_survey')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Animal Quick Log Modal (Distance Sampling Perpendicular Distance) */}
      <Modal visible={isLoggingAnimal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Enregistrer une détection</Text>

            <View style={styles.toggleRow}>
              {(['cat', 'dog'] as Species[]).map((sp) => (
                <TouchableOpacity
                  key={sp}
                  style={[styles.protocolBtn, sightingSpecies === sp && styles.protocolBtnActive]}
                  onPress={() => setSightingSpecies(sp)}
                >
                  <Text style={styles.protocolText}>{sp === 'cat' ? '🐱 Chat' : '🐶 Chien'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Distance from Path (Distance Sampling g(x)) */}
            <Text style={styles.inputLabel}>{t('survey.distance_from_path')}</Text>
            <TextInput
              style={styles.numInput}
              keyboardType="numeric"
              value={distanceFromPathM}
              onChangeText={setDistanceFromPathM}
              placeholder="Ex: 8.5"
            />
            <Text style={styles.inputHelp}>
              Distance perpendiculaire estimée entre l'animal et la trajectoire de marche.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsLoggingAnimal(false)}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddSighting}>
                <Text style={styles.confirmBtnText}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* eBird Complete Checklist Modal (Mandatory for Non-Detections) */}
      <Modal visible={showEndModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalEmoji}>📋</Text>
            <Text style={styles.modalTitle}>{t('survey.complete_question')}</Text>
            <Text style={styles.completeExplanation}>
              {t('survey.complete_explanation')}
            </Text>

            <TouchableOpacity
              style={styles.completeYesBtn}
              onPress={() => confirmEndSurvey(true)}
            >
              <Text style={styles.completeYesText}>✓ {t('survey.yes_complete')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeNoBtn}
              onPress={() => confirmEndSurvey(false)}
            >
              <Text style={styles.completeNoText}>{t('survey.no_incomplete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  scroll: { padding: 20 },
  setupCard: { gap: 14 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  toggleRow: { flexDirection: 'row', gap: 12 },
  protocolBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 6,
  },
  protocolBtnActive: { borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  protocolEmoji: { fontSize: 24 },
  protocolText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  protocolTextActive: { color: '#0F766E', fontWeight: '700' },
  routeOption: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  routeOptionActive: { borderColor: '#0F766E', backgroundColor: '#F0FDFA' },
  routeName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  routeSub: { fontSize: 12, color: '#64748B' },
  startBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  startBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  hudCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 20,
  },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
  liveText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  hudMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
  },
  hudBox: { alignItems: 'center', flex: 1 },
  hudVal: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  hudLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  hudDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  addAnimalBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  addAnimalBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  stopBtnText: { color: '#DC2626', fontSize: 15, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    gap: 16,
  },
  modalEmoji: { fontSize: 32, textAlign: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  completeExplanation: { fontSize: 14, color: '#475569', lineHeight: 20, textAlign: 'center' },
  completeYesBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeYesText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  completeNoBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeNoText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#334155' },
  numInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '700',
  },
  inputHelp: { fontSize: 12, color: '#64748B' },
  modalBtnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelBtnText: { color: '#475569', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#0F766E', alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontWeight: '700' },
});
