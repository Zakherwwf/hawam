import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { IOSColors, IOSTypography } from '../../theme/ios';
import { IOSIcon } from '../ios';
import { ColonySpecies, useColoniesStore } from '../../features/colonies/coloniesStore';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticTabSwitch,
  hapticSuccess,
} from '../../utils/haptics';

interface CreateColonyModalProps {
  visible: boolean;
  onClose: () => void;
  initialLat?: number;
  initialLon?: number;
}

export const CreateColonyModal: React.FC<CreateColonyModalProps> = ({
  visible,
  onClose,
  initialLat = 36.8065,
  initialLon = 10.1815,
}) => {
  const { addColony } = useColoniesStore();

  const [species, setSpecies] = useState<ColonySpecies>('cat');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [zone, setZone] = useState('');
  const [latitude, setLatitude] = useState(initialLat.toFixed(6));
  const [longitude, setLongitude] = useState(initialLon.toFixed(6));
  const [estimatedPopulation, setEstimatedPopulation] = useState('6');
  const [tnrSterilizedCount, setTnrSterilizedCount] = useState('2');
  const [hasWaterStation, setHasWaterStation] = useState(false);
  const [hasShelter, setHasShelter] = useState(false);
  const [caretakerName, setCaretakerName] = useState('');
  const [feedingSchedule, setFeedingSchedule] = useState('');
  const [notes, setNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (visible) {
      setLatitude(initialLat.toFixed(6));
      setLongitude(initialLon.toFixed(6));
    }
  }, [visible, initialLat, initialLon]);

  const isDog = species === 'dog';
  const groupLabel = isDog ? 'Dog Pack' : 'Cat Colony';
  const accentColor = isDog ? '#EA580C' : '#7C3AED';

  const popNum = Math.max(1, parseInt(estimatedPopulation, 10) || 1);
  const tnrNum = Math.min(popNum, Math.max(0, parseInt(tnrSterilizedCount, 10) || 0));
  const tnrPct = Math.round((tnrNum / popNum) * 100);

  const handleFetchGPS = async () => {
    hapticButtonPress();
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLatitude(loc.coords.latitude.toFixed(6));
        setLongitude(loc.coords.longitude.toFixed(6));
        hapticSuccess();
      } else {
        Alert.alert('Location Permission', 'GPS permission is needed to auto-fill coordinates.');
      }
    } catch (e) {
      Alert.alert('GPS Error', 'Could not obtain current location.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleClose = () => {
    hapticModalClose();
    onClose();
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required Field', 'Please enter a name for this animal group.');
      return;
    }

    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid latitude and longitude numbers.');
      return;
    }

    hapticSuccess();

    addColony({
      name: name.trim(),
      nameAr: nameAr.trim() || undefined,
      species,
      zone: zone.trim() || 'Grand Tunis',
      latitude: lat,
      longitude: lon,
      estimatedPopulation: popNum,
      tnrSterilizedCount: tnrNum,
      hasWaterStation,
      hasShelter,
      caretakerName: caretakerName.trim() || undefined,
      feedingSchedule: feedingSchedule.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    Alert.alert(
      isDog ? 'Dog Pack Registered' : 'Cat Colony Registered',
      `"${name.trim()}" has been saved and pinned to the map!\n+20 XP awarded!`,
      [{ text: 'OK', onPress: handleClose }]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity onPress={handleClose} style={styles.navBtn}>
            <Text style={styles.navCancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>
            {isDog ? 'Register Dog Pack' : 'Register Cat Colony'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={[styles.navBtn, styles.saveNavBtn]}>
            <Text style={[styles.navSaveText, { color: accentColor }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Species Selector Segmented Control */}
            <View style={styles.speciesSegmentWrap}>
              <TouchableOpacity
                style={[styles.speciesSegmentBtn, !isDog && styles.speciesSegmentBtnCatActive]}
                onPress={() => {
                  hapticTabSwitch();
                  setSpecies('cat');
                }}
                activeOpacity={0.8}
              >
                <IOSIcon name="paw" size={18} color={!isDog ? '#8B5CF6' : '#94A3B8'} />
                <View>
                  <Text style={[styles.speciesSegmentTitle, !isDog && styles.speciesSegmentTitleActive]}>
                    Cat Colony
                  </Text>
                  <Text style={styles.speciesSegmentSub}>مستعمرة قطط</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.speciesSegmentBtn, isDog && styles.speciesSegmentBtnDogActive]}
                onPress={() => {
                  hapticTabSwitch();
                  setSpecies('dog');
                }}
                activeOpacity={0.8}
              >
                <IOSIcon name="paw" size={18} color={isDog ? '#EA580C' : '#94A3B8'} />
                <View>
                  <Text style={[styles.speciesSegmentTitle, isDog && styles.speciesSegmentTitleActiveDog]}>
                    Dog Pack
                  </Text>
                  <Text style={styles.speciesSegmentSub}>قطيع كلاب</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Section 1: Identity & Location */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <IOSIcon name="paw" size={16} color={accentColor} />
                <Text style={styles.cardTitle}>{groupLabel} Information</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Name / Identifier *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={isDog ? 'e.g., Meute Marché Bab El Khadra' : 'e.g., Colonie Bab Souika'}
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Zone / Delegation</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Tunis Médina, La Marsa, Radès"
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  value={zone}
                  onChangeText={setZone}
                />
              </View>
            </View>

            {/* Section 2: Geographic Coordinates */}
            <View style={styles.card}>
              <View style={styles.cardHeaderBetween}>
                <View style={styles.cardHeaderLeft}>
                  <IOSIcon name="location" size={16} color="#0284C7" />
                  <Text style={styles.cardTitle}>Station Core Location</Text>
                </View>
                <TouchableOpacity
                  style={styles.gpsPillBtn}
                  onPress={handleFetchGPS}
                  disabled={isLocating}
                >
                  <IOSIcon name="location" size={13} color="#0284C7" />
                  <Text style={styles.gpsPillText}>
                    {isLocating ? 'Locating...' : 'Use My GPS'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.coordsRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Latitude</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={latitude}
                    onChangeText={setLatitude}
                  />
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Longitude</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={longitude}
                    onChangeText={setLongitude}
                  />
                </View>
              </View>
            </View>

            {/* Section 3: Population & Sterilization (TNR) */}
            <View style={styles.card}>
              <View style={styles.cardHeaderBetween}>
                <View style={styles.cardHeaderLeft}>
                  <IOSIcon name="shield" size={16} color="#10B981" />
                  <Text style={styles.cardTitle}>Population & Sterilization (TNR)</Text>
                </View>
                <View
                  style={[
                    styles.tnrBadge,
                    { backgroundColor: tnrPct >= 75 ? '#DCFCE7' : tnrPct >= 50 ? '#FEF3C7' : '#FEE2E2' },
                  ]}
                >
                  <Text
                    style={[
                      styles.tnrBadgeText,
                      { color: tnrPct >= 75 ? '#15803D' : tnrPct >= 50 ? '#B45309' : '#B91C1C' },
                    ]}
                  >
                    {tnrPct}% Sterilized
                  </Text>
                </View>
              </View>

              <View style={styles.coordsRow}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Estimated Population</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        hapticButtonPress();
                        setEstimatedPopulation(String(Math.max(1, popNum - 1)));
                      }}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="number-pad"
                      value={estimatedPopulation}
                      onChangeText={setEstimatedPopulation}
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        hapticButtonPress();
                        setEstimatedPopulation(String(popNum + 1));
                      }}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Sterilized Count</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        hapticButtonPress();
                        setTnrSterilizedCount(String(Math.max(0, tnrNum - 1)));
                      }}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={styles.stepperInput}
                      keyboardType="number-pad"
                      value={tnrSterilizedCount}
                      onChangeText={setTnrSterilizedCount}
                    />
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        hapticButtonPress();
                        setTnrSterilizedCount(String(Math.min(popNum, tnrNum + 1)));
                      }}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {/* Section 4: Welfare Infrastructure Facilities */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <IOSIcon name="shield" size={16} color="#0284C7" />
                <Text style={styles.cardTitle}>Station Facilities</Text>
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchLabelWrap}>
                  <Text style={styles.switchTitle}>Clean Water Station</Text>
                  <Text style={styles.switchSubtitle}>Permanent bowl or fresh water dispenser</Text>
                </View>
                <Switch
                  value={hasWaterStation}
                  onValueChange={setHasWaterStation}
                  trackColor={{ false: '#E2E8F0', true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                <View style={styles.switchLabelWrap}>
                  <Text style={styles.switchTitle}>Weather Shelter</Text>
                  <Text style={styles.switchSubtitle}>Covered box, wooden niche, or dry alcove</Text>
                </View>
                <Switch
                  value={hasShelter}
                  onValueChange={setHasShelter}
                  trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {/* Section 5: Caretaker & Routine */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <IOSIcon name="person" size={16} color="#6366F1" />
                <Text style={styles.cardTitle}>Caretaker & Feeding Routine</Text>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Primary Caretaker / Volunteer</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Local café staff, Madame Sonia, SOS Animaux"
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  value={caretakerName}
                  onChangeText={setCaretakerName}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Feeding Schedule</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Daily at 07:00 & 19:30"
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  value={feedingSchedule}
                  onChangeText={setFeedingSchedule}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Notes & Observations</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g., 2 pregnant females, peaceful behavior, vaccinated during municipal vet campaign"
                  placeholderTextColor={IOSColors.tertiaryLabel}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </View>

            {/* XP Gamification Incentive Banner */}
            <View style={styles.xpBanner}>
              <View style={styles.xpBadge}>
                <Text style={styles.xpBadgeText}>+20 XP</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.xpBannerTitle}>Citizen Science Reward</Text>
                <Text style={styles.xpBannerSub}>
                  Registering community animal groups helps track TNR sterilization and prevents municipal culls.
                </Text>
              </View>
            </View>

            {/* Bottom Save Action Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accentColor }]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <IOSIcon name="check" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>
                Register {groupLabel} (+20 XP)
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  navBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  saveNavBtn: {
    paddingHorizontal: 12,
  },
  navCancelText: {
    fontSize: 16,
    color: IOSColors.secondaryLabel,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOSColors.label,
  },
  navSaveText: {
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  speciesSegmentWrap: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  speciesSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  speciesSegmentBtnCatActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F5F3FF',
  },
  speciesSegmentBtnDogActive: {
    borderColor: '#EA580C',
    backgroundColor: '#FFF7ED',
  },
  speciesSegmentEmoji: {
    fontSize: 26,
  },
  speciesSegmentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
  },
  speciesSegmentTitleActive: {
    color: '#7C3AED',
  },
  speciesSegmentTitleActiveDog: {
    color: '#EA580C',
  },
  speciesSegmentSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IOSColors.label,
  },
  gpsPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  gpsPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: IOSColors.label,
  },
  textArea: {
    minHeight: 68,
    textAlignVertical: 'top',
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tnrBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tnrBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: '700',
    color: IOSColors.label,
  },
  stepperInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: IOSColors.label,
    paddingVertical: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  switchLabelWrap: {
    flex: 1,
    marginRight: 12,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: IOSColors.label,
  },
  switchSubtitle: {
    fontSize: 12,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  xpBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    marginBottom: 20,
  },
  xpBadge: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  xpBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  xpBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B21A8',
  },
  xpBannerSub: {
    fontSize: 12,
    color: '#7E22CE',
    marginTop: 2,
    lineHeight: 16,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
