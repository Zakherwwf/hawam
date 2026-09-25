import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  Image,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSColors, IOSTypography } from '../theme/ios';
import { LinearGradient } from 'expo-linear-gradient';
import { IOSIcon } from '../components/ios';
import { InteractiveMapView, MapMarker, FocusCoordinate } from '../components/map/InteractiveMapView';
import { SightingItem } from './SightingsScreen';
import { useColoniesStore, CatColony } from '../features/colonies/coloniesStore';
import { ColonyInspectorModal } from '../components/colonies/ColonyInspectorModal';
import { CreateColonyModal } from '../components/colonies/CreateColonyModal';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticQuickLog,
  hapticTabSwitch,
} from '../utils/haptics';

const GOVERNORATES = [
  'Tunis',
  'Ariana',
  'Ben Arous',
  'Manouba',
  'Nabeul',
  'Bizerte',
  'Sousse',
  'Monastir',
  'Sfax',
];

const GOV_COORDINATES: Record<string, FocusCoordinate> = {
  Tunis: { latitude: 36.8065, longitude: 10.1815, zoom: 13 },
  Ariana: { latitude: 36.8665, longitude: 10.1956, zoom: 13 },
  'Ben Arous': { latitude: 36.7533, longitude: 10.2222, zoom: 13 },
  Manouba: { latitude: 36.8080, longitude: 10.0972, zoom: 13 },
  Nabeul: { latitude: 36.4561, longitude: 10.7376, zoom: 13 },
  Bizerte: { latitude: 37.2746, longitude: 9.8739, zoom: 13 },
  Sousse: { latitude: 35.8256, longitude: 10.6369, zoom: 13 },
  Monastir: { latitude: 35.7780, longitude: 10.8262, zoom: 13 },
  Sfax: { latitude: 34.7406, longitude: 10.7603, zoom: 13 },
};

type FilterCategory = 'all' | 'transects' | 'colonies' | 'cats' | 'dogs';

interface MapOverviewScreenProps {
  sightings: SightingItem[];
  onQuickSighting: () => void;
  onSelectSighting?: (sighting: SightingItem) => void;
  onOpenAccount?: () => void;
  onToggleDashboard?: () => void;
}

export const MapOverviewScreen: React.FC<MapOverviewScreenProps> = ({
  sightings,
  onQuickSighting,
  onSelectSighting,
  onOpenAccount,
  onToggleDashboard,
}) => {
  const [selectedGovernorate, setSelectedGovernorate] = useState<string>('Tunis');
  const [showGovPicker, setShowGovPicker] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [selectedSightingId, setSelectedSightingId] = useState<string | null>(null);
  const [focusCoordinate, setFocusCoordinate] = useState<FocusCoordinate | null>(null);

  // Advanced Filter Sheet State
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [filterBcs, setFilterBcs] = useState<number | 'all'>('all');
  const [filterOnlyWithPhotos, setFilterOnlyWithPhotos] = useState<boolean>(false);
  const [filterProtocol, setFilterProtocol] = useState<'all' | 'transect' | 'stationary_point' | 'incidental'>('all');

  // Notifications Modal State
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState<boolean>(true);

  const { colonies } = useColoniesStore();
  const [selectedColony, setSelectedColony] = useState<CatColony | null>(null);
  const [showCreateColonyModal, setShowCreateColonyModal] = useState<boolean>(false);

  const hasActiveAdvancedFilters =
    filterBcs !== 'all' || filterOnlyWithPhotos || filterProtocol !== 'all';

  // Filter sightings by category, search query, and advanced criteria
  const filteredSightings = useMemo(() => {
    return sightings.filter((s) => {
      if (activeFilter === 'cats' && s.species !== 'cat') return false;
      if (activeFilter === 'dogs' && s.species !== 'dog') return false;
      if (activeFilter === 'colonies') return false;
      if (filterBcs !== 'all' && s.body_condition_score !== filterBcs) return false;
      if (filterOnlyWithPhotos && (!s.photos || s.photos.length === 0)) return false;
      if (filterProtocol !== 'all' && s.protocol !== filterProtocol) return false;

      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchNotes = s.notes ? s.notes.toLowerCase().includes(q) : false;
        const matchSpecies = s.species.toLowerCase().includes(q);
        const matchProtocol = s.protocol.toLowerCase().includes(q);
        return matchNotes || matchSpecies || matchProtocol;
      }
      return true;
    });
  }, [sightings, activeFilter, searchQuery, filterBcs, filterOnlyWithPhotos, filterProtocol]);

  // Convert filtered sightings to map markers
  const mapMarkers: MapMarker[] = useMemo(() => {
    if (activeFilter === 'colonies') return [];
    return filteredSightings.map((s, idx) => ({
      id: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      species: s.species,
      identifier: s.identifier,
      label: s.identifier ? s.identifier : `${s.species === 'cat' ? 'CAT' : 'DOG'} #${idx + 1}`,
      title: s.identifier ? s.identifier : `${s.species === 'cat' ? 'Cat' : 'Dog'} (${s.group_size || 1})`,
      distance_from_path_m: s.distance_from_path_m,
    }));
  }, [filteredSightings, activeFilter]);

  // Filter colonies
  const displayColonies = useMemo(() => {
    if (activeFilter === 'cats' || activeFilter === 'dogs') return [];
    return colonies;
  }, [colonies, activeFilter]);

  const selectedSighting = sightings.find((s) => s.id === selectedSightingId);

  const catCount = sightings.filter((s) => s.species === 'cat').length;
  const dogCount = sightings.filter((s) => s.species === 'dog').length;

  const handleCloseGovPicker = () => {
    hapticModalClose();
    setShowGovPicker(false);
  };

  const handleCloseFilterModal = () => {
    hapticModalClose();
    setShowFilterModal(false);
  };

  const handleCloseNotifications = () => {
    hapticModalClose();
    setShowNotificationsModal(false);
  };

  const handleCloseSightingCard = () => {
    hapticModalClose();
    setSelectedSightingId(null);
  };

  const handleCloseColonyModal = () => {
    hapticModalClose();
    setSelectedColony(null);
  };

  // Swipe-to-dismiss PanResponder for selected sighting bottom card
  const cardPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 6,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > 30 || gestureState.vy > 0.3) {
            handleCloseSightingCard();
          }
        },
      }),
    []
  );

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Modern Explore Header */}
        <View style={styles.headerContainer}>
          {/* Top Row: Location Selector & Action Icons */}
          <View style={styles.locationRow}>
            <TouchableOpacity
              style={styles.locationSelector}
              onPress={() => {
                hapticButtonPress();
                setShowGovPicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.locationSubLabel}>LOCATION</Text>
              <View style={styles.locationTitleRow}>
                <Text style={styles.locationTitleText}>{selectedGovernorate}</Text>
                <IOSIcon name="chevronDown" size={16} color="#0F172A" />
              </View>
            </TouchableOpacity>

            <View style={styles.headerRightButtons}>
              {/* Dashboard View Switcher */}
              {onToggleDashboard && (
                <TouchableOpacity
                  style={styles.dashboardCapsuleBtn}
                  activeOpacity={0.75}
                  onPress={() => {
                    hapticTabSwitch();
                    onToggleDashboard();
                  }}
                >
                  <IOSIcon name="chart" size={15} color="#0F172A" />
                  <Text style={styles.dashboardCapsuleText}>Dashboard</Text>
                </TouchableOpacity>
              )}

              {/* Notification Bell with Unread Dot */}
              <TouchableOpacity
                style={styles.circleIconButton}
                activeOpacity={0.7}
                onPress={() => {
                  hapticButtonPress();
                  setShowNotificationsModal(true);
                }}
              >
                <IOSIcon name="bell" size={18} color="#0F172A" />
                {hasUnreadNotifications && <View style={styles.bellDot} />}
              </TouchableOpacity>

              {/* Profile Avatar: Navigates to Account Tab */}
              <TouchableOpacity
                style={styles.avatarContainer}
                activeOpacity={0.75}
                onPress={() => {
                  hapticTabSwitch();
                  if (onOpenAccount) onOpenAccount();
                }}
              >
                <Image
                  source={require('../../assets/icon_cat_white.png')}
                  style={{ width: 22, height: 22, resizeMode: 'contain' }}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Rounded Search Capsule */}
          <View style={styles.searchBarContainer}>
            <IOSIcon name="search" size={18} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transects, zones, animals..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IOSIcon name="xmark" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
            {/* Filter Sliders Button: Opens Advanced Filter Sheet */}
            <TouchableOpacity
              style={[
                styles.searchFilterBtn,
                hasActiveAdvancedFilters && styles.searchFilterBtnActive,
              ]}
              activeOpacity={0.8}
              onPress={() => {
                hapticButtonPress();
                setShowFilterModal(true);
              }}
            >
              <IOSIcon
                name="sliders"
                size={15}
                color={hasActiveAdvancedFilters ? '#0F172A' : '#FFFFFF'}
              />
            </TouchableOpacity>
          </View>

          {/* Fast Governorate Quick Selector Strip */}
          <View style={styles.scrollWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.govScrollRow}
            >
              {GOVERNORATES.map((gov) => {
                const isSelected = selectedGovernorate === gov;
                return (
                  <TouchableOpacity
                    key={gov}
                    style={[styles.govCapsule, isSelected && styles.govCapsuleActive]}
                    onPress={() => {
                      hapticButtonPress();
                      setSelectedGovernorate(gov);
                      const coords = GOV_COORDINATES[gov];
                      if (coords) {
                        setFocusCoordinate(coords);
                      }
                    }}
                    activeOpacity={0.75}
                  >
                    <IOSIcon
                      name="location"
                      size={10}
                      color={isSelected ? '#0F172A' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.govCapsuleText,
                        isSelected && styles.govCapsuleTextActive,
                      ]}
                    >
                      {gov}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <LinearGradient
              colors={['rgba(253, 242, 236, 0.95)', 'rgba(253, 242, 236, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeLeft}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(251, 244, 237, 0)', 'rgba(251, 244, 237, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeRight}
              pointerEvents="none"
            />
          </View>

          {/* Horizontal Filter Capsule Tags */}
          <View style={styles.scrollWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'all' && styles.filterPillActive,
                ]}
                onPress={() => {
                  hapticTabSwitch();
                  setActiveFilter('all');
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'all' && styles.filterPillTextActive,
                  ]}
                >
                  All ({sightings.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'transects' && styles.filterPillActive,
                ]}
                onPress={() => {
                  hapticTabSwitch();
                  setActiveFilter('transects');
                }}
                activeOpacity={0.8}
              >
                <IOSIcon
                  name="compass"
                  size={13}
                  color={activeFilter === 'transects' ? '#FFFFFF' : '#475569'}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'transects' && styles.filterPillTextActive,
                  ]}
                >
                  Transects
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'colonies' && styles.filterPillActive,
                ]}
                onPress={() => {
                  hapticTabSwitch();
                  setActiveFilter('colonies');
                }}
                activeOpacity={0.8}
              >
                <IOSIcon
                  name="shield"
                  size={13}
                  color={activeFilter === 'colonies' ? '#FFFFFF' : '#475569'}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'colonies' && styles.filterPillTextActive,
                  ]}
                >
                  Colonies & Packs ({colonies.length})
                </Text>
              </TouchableOpacity>

              {/* Quick Register Colony/Pack Button */}
              <TouchableOpacity
                style={styles.registerColonyPill}
                onPress={() => {
                  hapticButtonPress();
                  setShowCreateColonyModal(true);
                }}
                activeOpacity={0.8}
              >
                <IOSIcon name="plus" size={12} color="#7C3AED" />
                <Text style={styles.registerColonyPillText}>+ Register Group</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'cats' && styles.filterPillActive,
                ]}
                onPress={() => {
                  hapticTabSwitch();
                  setActiveFilter('cats');
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={
                    activeFilter === 'cats'
                      ? require('../../assets/icon_cat_white.png')
                      : require('../../assets/icon_cat_primary.png')
                  }
                  style={{ width: 15, height: 15, resizeMode: 'contain' }}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'cats' && styles.filterPillTextActive,
                  ]}
                >
                  Cats ({catCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterPill,
                  activeFilter === 'dogs' && styles.filterPillActive,
                ]}
                onPress={() => {
                  hapticTabSwitch();
                  setActiveFilter('dogs');
                }}
                activeOpacity={0.8}
              >
                <Image
                  source={
                    activeFilter === 'dogs'
                      ? require('../../assets/icon_dog_white.png')
                      : require('../../assets/icon_dog_amber.png')
                  }
                  style={{ width: 15, height: 15, resizeMode: 'contain' }}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    activeFilter === 'dogs' && styles.filterPillTextActive,
                  ]}
                >
                  Dogs ({dogCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>
            <LinearGradient
              colors={['rgba(253, 242, 236, 0.95)', 'rgba(253, 242, 236, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeLeft}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(251, 244, 237, 0)', 'rgba(251, 244, 237, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeRight}
              pointerEvents="none"
            />
          </View>
        </View>

        {/* Main Interactive Map Canvas */}
        <View style={styles.mapWrapper}>
          <InteractiveMapView
            initialLat={36.8065}
            initialLon={10.1815}
            initialZoom={14}
            focusCoordinate={focusCoordinate}
            markers={mapMarkers}
            colonyMarkers={displayColonies.map((c) => ({
              id: c.id,
              name: c.name,
              species: c.species,
              latitude: c.latitude,
              longitude: c.longitude,
              estimatedPopulation: c.estimatedPopulation,
              tnrPercent: Math.round(
                (c.tnrSterilizedCount / Math.max(1, c.estimatedPopulation)) * 100
              ),
              hasWaterStation: c.hasWaterStation,
              hasShelter: c.hasShelter,
            }))}
            showUserLocation={true}
            onMarkerPress={(id) => {
              setSelectedSightingId(id);
              const s = sightings.find((item) => item.id === id);
              if (s) {
                setFocusCoordinate({ latitude: s.latitude, longitude: s.longitude, zoom: 16 });
                if (onSelectSighting) onSelectSighting(s);
              }
            }}
            onColonyPress={(id) => {
              const col = colonies.find((c) => c.id === id);
              setSelectedColony(col || null);
              if (col) {
                setFocusCoordinate({ latitude: col.latitude, longitude: col.longitude, zoom: 16 });
              }
            }}
            height="100%"
          />

          {/* Reference 1: Weather & Survey Condition Pill */}
          <View style={styles.weatherConditionChip}>
            <IOSIcon name="sun" size={14} color="#D97706" />
            <Text style={styles.weatherConditionText}>26°C Clear</Text>
            <View style={styles.weatherDivider} />
            <Text style={styles.conditionTierText}>Tier 1 Visibility</Text>
          </View>

          {/* Empty state guide capsule when 0 sightings */}
          {!selectedSighting && sightings.length === 0 && (
            <View style={styles.cleanStartGuideBox}>
              <IOSIcon name="location" size={14} color="#0284C7" />
              <Text style={styles.cleanStartGuideText}>
                No local sightings yet. Tap below to log your first field observation!
              </Text>
            </View>
          )}

          {/* Floating Quick Action Button */}
          {!selectedSighting && (
            <TouchableOpacity
              style={[
                styles.floatingActionBtn,
                activeFilter === 'colonies' && styles.floatingActionBtnColony,
              ]}
              onPress={() => {
                if (activeFilter === 'colonies') {
                  hapticButtonPress();
                  setShowCreateColonyModal(true);
                } else {
                  hapticQuickLog();
                  onQuickSighting();
                }
              }}
              activeOpacity={0.85}
            >
              <IOSIcon name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.floatingActionText}>
                {activeFilter === 'colonies' ? 'Register Colony / Pack' : 'Record Observation'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Selected Marker Detail Card with Swipe-to-Dismiss */}
          {selectedSighting ? (
            <View style={styles.sightingCard} {...cardPanResponder.panHandlers}>
              {/* Visual Pull-Down Drag Handle */}
              <View style={styles.cardDragHandleContainer}>
                <View style={styles.cardDragHandle} />
              </View>

              <View style={styles.sightingCardTop}>
                <View style={styles.sightingSpeciesRow}>
                  <View
                    style={[
                      styles.speciesIconPill,
                      {
                        backgroundColor:
                          selectedSighting.species === 'cat'
                            ? '#E0F2FE'
                            : '#FEF3C7',
                      },
                    ]}
                  >
                    <Image
                      source={
                        selectedSighting.species === 'cat'
                          ? require('../../assets/icon_cat_primary.png')
                          : require('../../assets/icon_dog_amber.png')
                      }
                      style={{ width: 14, height: 14, resizeMode: 'contain' }}
                    />
                    <Text
                      style={[
                        styles.speciesPillText,
                        {
                          color:
                            selectedSighting.species === 'cat'
                              ? '#0284C7'
                              : '#D97706',
                        },
                      ]}
                    >
                      {selectedSighting.species === 'cat' ? 'Cat' : 'Dog'}
                    </Text>
                  </View>

                  {selectedSighting.body_condition_score ? (
                    <View style={styles.bcsChip}>
                      <Text style={styles.bcsChipText}>
                        BCS {selectedSighting.body_condition_score}/5
                      </Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={handleCloseSightingCard}
                  style={styles.closeCardBtn}
                >
                  <IOSIcon name="xmark" size={14} color="#64748B" />
                </TouchableOpacity>
              </View>

              {/* Sighting Identifier Headline */}
              <Text style={styles.sightingIdentifierHeadline}>
                {selectedSighting.identifier || `${selectedSighting.species === 'cat' ? 'Cat' : 'Dog'} (${selectedSighting.group_size || 1})`}
              </Text>

              {/* Observer Attribution */}
              <Text style={styles.sightingObserverText}>
                Logged by {selectedSighting.observer_name || 'You'} • {new Date(selectedSighting.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>

              <Text style={styles.sightingCoords}>
                {selectedSighting.latitude.toFixed(5)}° N,{' '}
                {selectedSighting.longitude.toFixed(5)}° E
              </Text>

              {selectedSighting.notes ? (
                <Text style={styles.sightingNotes} numberOfLines={2}>
                  "{selectedSighting.notes}"
                </Text>
              ) : null}

              <View style={styles.sightingFooter}>
                <Text style={styles.sightingMeta}>
                  Distance:{' '}
                  {selectedSighting.distance_from_path_m !== undefined
                    ? `${selectedSighting.distance_from_path_m.toFixed(1)}m`
                    : 'N/A'}{' '}
                  • Protocol: {selectedSighting.protocol}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* Governorate Selector Modal */}
        <Modal
          visible={showGovPicker}
          transparent
          animationType="fade"
          onRequestClose={handleCloseGovPicker}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCloseGovPicker}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Survey Governorate</Text>
                <TouchableOpacity onPress={handleCloseGovPicker}>
                  <IOSIcon name="xmark" size={20} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 320 }}>
                {GOVERNORATES.map((gov) => (
                  <TouchableOpacity
                    key={gov}
                    style={[
                      styles.govOptionRow,
                      selectedGovernorate === gov && styles.govOptionRowSelected,
                    ]}
                    onPress={() => {
                      hapticTabSwitch();
                      setSelectedGovernorate(gov);
                      setShowGovPicker(false);
                      if (GOV_COORDINATES[gov]) {
                        setFocusCoordinate(GOV_COORDINATES[gov]);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.govOptionText,
                        selectedGovernorate === gov && styles.govOptionTextSelected,
                      ]}
                    >
                      {gov}
                    </Text>
                    {selectedGovernorate === gov && (
                      <IOSIcon name="check" size={18} color="#0D9488" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Advanced Filter Modal (Sliders Button) */}
        <Modal
          visible={showFilterModal}
          transparent
          animationType="slide"
          onRequestClose={handleCloseFilterModal}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCloseFilterModal}
          >
            <View style={[styles.modalSheet, { maxHeight: 520 }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IOSIcon name="sliders" size={18} color="#0F172A" />
                  <Text style={styles.modalTitle}>Filter Observations</Text>
                </View>
                <TouchableOpacity onPress={handleCloseFilterModal}>
                  <IOSIcon name="xmark" size={20} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* BCS Filter Section */}
                <Text style={styles.filterSectionTitle}>Body Condition Score (ICAM BCS 1–5)</Text>
                <View style={styles.filterChipRow}>
                  {(['all', 1, 2, 3, 4, 5] as const).map((score) => (
                    <TouchableOpacity
                      key={score.toString()}
                      style={[
                        styles.filterModalChip,
                        filterBcs === score && styles.filterModalChipActive,
                      ]}
                      onPress={() => {
                        hapticTabSwitch();
                        setFilterBcs(score);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterModalChipText,
                          filterBcs === score && styles.filterModalChipTextActive,
                        ]}
                      >
                        {score === 'all' ? 'Any BCS' : `BCS ${score}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Protocol Filter Section */}
                <Text style={styles.filterSectionTitle}>Sampling Protocol</Text>
                <View style={styles.filterChipRow}>
                  {[
                    { label: 'All Protocols', value: 'all' },
                    { label: 'Transect', value: 'transect' },
                    { label: 'Stationary', value: 'stationary_point' },
                    { label: 'Incidental', value: 'incidental' },
                  ].map((p) => (
                    <TouchableOpacity
                      key={p.value}
                      style={[
                        styles.filterModalChip,
                        filterProtocol === p.value && styles.filterModalChipActive,
                      ]}
                      onPress={() => {
                        hapticTabSwitch();
                        setFilterProtocol(p.value as any);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterModalChipText,
                          filterProtocol === p.value && styles.filterModalChipTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Photos Only Toggle */}
                <TouchableOpacity
                  style={styles.filterToggleRow}
                  onPress={() => {
                    hapticButtonPress();
                    setFilterOnlyWithPhotos(!filterOnlyWithPhotos);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.filterToggleTitle}>Photos Attached Only</Text>
                    <Text style={styles.filterToggleSub}>
                      Show only sightings with photographic identification
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.toggleSwitchTrack,
                      filterOnlyWithPhotos && styles.toggleSwitchTrackOn,
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleSwitchThumb,
                        filterOnlyWithPhotos && styles.toggleSwitchThumbOn,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              </ScrollView>

              {/* Filter Actions */}
              <View style={styles.filterModalActions}>
                <TouchableOpacity
                  style={styles.filterResetBtn}
                  onPress={() => {
                    hapticButtonPress();
                    setFilterBcs('all');
                    setFilterProtocol('all');
                    setFilterOnlyWithPhotos(false);
                  }}
                >
                  <Text style={styles.filterResetBtnText}>Reset All</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.filterApplyBtn}
                  onPress={handleCloseFilterModal}
                >
                  <Text style={styles.filterApplyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Notifications / Bulletins Modal (Bell Icon) */}
        <Modal
          visible={showNotificationsModal}
          transparent
          animationType="fade"
          onRequestClose={handleCloseNotifications}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={handleCloseNotifications}
          >
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IOSIcon name="bell" size={18} color="#0F172A" />
                  <Text style={styles.modalTitle}>Observatory Bulletins</Text>
                </View>
                <TouchableOpacity onPress={handleCloseNotifications}>
                  <IOSIcon name="xmark" size={20} color="#0F172A" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <View style={styles.bulletinItem}>
                  <View style={[styles.bulletinDot, { backgroundColor: '#10B981' }]} />
                  <View style={styles.bulletinContent}>
                    <View style={styles.bulletinTopRow}>
                      <Text style={styles.bulletinTitle}>Cloud Telemetry Synchronized</Text>
                      <Text style={styles.bulletinTime}>Just now</Text>
                    </View>
                    <Text style={styles.bulletinBody}>
                      100% of field records and GPS track waypoints are backed up to the Supabase research cluster.
                    </Text>
                  </View>
                </View>

                <View style={styles.bulletinItem}>
                  <View style={[styles.bulletinDot, { backgroundColor: '#0284C7' }]} />
                  <View style={styles.bulletinContent}>
                    <View style={styles.bulletinTopRow}>
                      <Text style={styles.bulletinTitle}>Institut Pasteur Campaign</Text>
                      <Text style={styles.bulletinTime}>2h ago</Text>
                    </View>
                    <Text style={styles.bulletinBody}>
                      Priority transect survey active in Ariana & Carthage. Standardized eBird-style protocol required.
                    </Text>
                  </View>
                </View>

                <View style={styles.bulletinItem}>
                  <View style={[styles.bulletinDot, { backgroundColor: '#F59E0B' }]} />
                  <View style={styles.bulletinContent}>
                    <View style={styles.bulletinTopRow}>
                      <Text style={styles.bulletinTitle}>Meteorological Advisory</Text>
                      <Text style={styles.bulletinTime}>Today</Text>
                    </View>
                    <Text style={styles.bulletinBody}>
                      Ambient temperature 26°C with Tier 1 visibility. Optimal conditions for distance sampling.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalActionBtn}
                onPress={() => {
                  hapticModalClose();
                  setHasUnreadNotifications(false);
                  setShowNotificationsModal(false);
                }}
              >
                <Text style={styles.modalActionBtnText}>Dismiss & Clear</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Colony Inspector Modal */}
        <ColonyInspectorModal
          visible={!!selectedColony}
          colony={selectedColony}
          onClose={handleCloseColonyModal}
        />

        {/* Create Colony / Pack Modal */}
        <CreateColonyModal
          visible={showCreateColonyModal}
          onClose={() => setShowCreateColonyModal(false)}
          initialLat={focusCoordinate?.latitude || 36.8065}
          initialLon={focusCoordinate?.longitude || 10.1815}
        />
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#F7F6F2',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationSelector: {
    flexDirection: 'column',
  },
  locationSubLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dashboardCapsuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  dashboardCapsuleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  circleIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    paddingVertical: 8,
  },
  searchFilterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterBtnActive: {
    backgroundColor: '#D9F944',
  },
  scrollWrapper: {
    position: 'relative',
  },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 14,
    zIndex: 2,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 14,
    zIndex: 2,
  },
  govScrollRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  govCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  govCapsuleActive: {
    backgroundColor: '#D9F944',
    borderColor: '#0F172A',
  },
  govCapsuleText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  govCapsuleTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  registerColonyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  registerColonyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  weatherConditionChip: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  weatherConditionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  weatherDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#CBD5E1',
  },
  conditionTierText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
  },
  floatingActionBtn: {
    position: 'absolute',
    bottom: 116,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  floatingActionBtnColony: {
    backgroundColor: '#7C3AED',
  },
  floatingActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sightingCard: {
    position: 'absolute',
    bottom: 116,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardDragHandleContainer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  cardDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
  },
  sightingCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sightingSpeciesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speciesIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  speciesPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bcsChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bcsChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  closeCardBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sightingIdentifierHeadline: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 2,
  },
  sightingObserverText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 6,
  },
  cleanStartGuideBox: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: '90%',
  },
  cleanStartGuideText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flexShrink: 1,
  },
  sightingCoords: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  sightingNotes: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  sightingFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  sightingMeta: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  govOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  govOptionRowSelected: {
    backgroundColor: '#F0FDFA',
  },
  govOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  govOptionTextSelected: {
    fontWeight: '800',
    color: '#0D9488',
  },
  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  filterModalChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterModalChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  filterModalChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterModalChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
    marginTop: 6,
  },
  filterToggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  filterToggleSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 2,
  },
  toggleSwitchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchTrackOn: {
    backgroundColor: '#0D9488',
  },
  toggleSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  filterModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  filterResetBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  filterResetBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  filterApplyBtn: {
    flex: 2,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  filterApplyBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bulletinItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
  },
  bulletinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  bulletinContent: {
    flex: 1,
  },
  bulletinTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  bulletinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  bulletinTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  bulletinBody: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 16,
  },
  modalActionBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
