import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IOSColors, IOSTypography, IOSLayout } from '../../theme/ios';
import { IOSIcon, IOSSegmentedControl, IOSButton } from '../ios';
import { useRoutesStore, FixedRoute } from '../../features/routes/routesStore';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticTabSwitch,
  hapticSuccess,
} from '../../utils/haptics';

interface RoutePickerModalProps {
  visible: boolean;
  selectedRouteId: string | null;
  onSelectRoute: (route: FixedRoute | null) => void;
  onClose: () => void;
}

export const RoutePickerModal: React.FC<RoutePickerModalProps> = ({
  visible,
  selectedRouteId,
  onSelectRoute,
  onClose,
}) => {
  const { routes, toggleAdoptRoute } = useRoutesStore();
  const [filterMode, setFilterMode] = useState<'all' | 'adopted'>('all');

  const filteredRoutes = routes.filter((r) => {
    if (filterMode === 'adopted') return r.isAdopted;
    return true;
  });

  const getDensityBadgeColor = (density: string) => {
    switch (density) {
      case 'high':
        return { bg: 'rgba(239, 68, 68, 0.12)', text: '#DC2626' };
      case 'medium':
        return { bg: 'rgba(245, 158, 11, 0.12)', text: '#D97706' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.12)', text: '#059669' };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        hapticModalClose();
        onClose();
      }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => {
              hapticModalClose();
              onClose();
            }}
            style={styles.navBtn}
          >
            <Text style={styles.navBtnText}>Done</Text>
          </TouchableOpacity>
          <Text style={styles.navTitle}>Transect Catalog</Text>
          <View style={styles.navRightPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Mediterranean Transect Illustration Header */}
          <View style={styles.catalogHeroWrapper}>
            <Image
              source={require('../../../assets/hero_transect_corridor.jpg')}
              style={styles.catalogHeroImage}
              resizeMode="cover"
            />
            <View style={styles.catalogHeroOverlay}>
              <View style={styles.catalogHeroBadge}>
                <Image
                  source={require('../../../assets/icon_cat_white.png')}
                  style={{ width: 14, height: 14, resizeMode: 'contain' }}
                />
                <Text style={styles.catalogHeroBadgeText}>MEDITERRANEAN CORRIDORS</Text>
                <Image
                  source={require('../../../assets/icon_dog_white.png')}
                  style={{ width: 14, height: 14, resizeMode: 'contain' }}
                />
              </View>
            </View>
          </View>

          {/* Header Explanation */}
          <View style={styles.headerBox}>
            <Text style={styles.headline}>Standardized Transects</Text>
            <Text style={styles.subheadline}>
              Surveying recurring routes allows rigorous spatial mark-resight and distance sampling models for Tunis municipal policy.
            </Text>
          </View>

          {/* Filter Segment */}
          <View style={styles.filterSegment}>
            <IOSSegmentedControl<'all' | 'adopted'>
              selectedValue={filterMode}
              onValueChange={(val) => {
                hapticTabSwitch();
                setFilterMode(val);
              }}
              values={[
                { label: `All Transects (${routes.length})`, value: 'all' },
                {
                  label: `Adopted (${routes.filter((r) => r.isAdopted).length})`,
                  value: 'adopted',
                },
              ]}
            />
          </View>

          {/* Free Unconstrained Route Option */}
          {filterMode === 'all' && (
            <TouchableOpacity
              style={[
                styles.routeCard,
                selectedRouteId === null && styles.routeCardSelected,
              ]}
              onPress={() => {
                hapticButtonPress();
                onSelectRoute(null);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <View style={styles.zoneTag}>
                  <IOSIcon name="map" size={13} color={IOSColors.systemTeal} />
                  <Text style={styles.zoneTagText}>EXPLORATION</Text>
                </View>
                {selectedRouteId === null && (
                  <View style={styles.selectedBadge}>
                    <IOSIcon name="check" size={14} color="#FFFFFF" />
                  </View>
                )}
              </View>
              <Text style={styles.routeTitle}>Free-Form Dynamic Route</Text>
              <Text style={styles.routeDescription}>
                Survey arbitrary streets or unmapped corridors. Telemetry records your exact path.
              </Text>
            </TouchableOpacity>
          )}

          {/* Catalog of Fixed Routes */}
          {filteredRoutes.map((route) => {
            const isSelected = selectedRouteId === route.id;
            const densityColors = getDensityBadgeColor(route.densityClassification);

            return (
              <View
                key={route.id}
                style={[styles.routeCard, isSelected && styles.routeCardSelected]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.zoneTag}>
                    <IOSIcon name="compass" size={13} color={IOSColors.systemIndigo} />
                    <Text style={styles.zoneTagText}>{route.zone.toUpperCase()}</Text>
                  </View>

                  <View style={[styles.densityBadge, { backgroundColor: densityColors.bg }]}>
                    <Text style={[styles.densityText, { color: densityColors.text }]}>
                      {route.densityClassification.toUpperCase()} DENSITY
                    </Text>
                  </View>
                </View>

                <View style={styles.titleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.routeTitle}>{route.name}</Text>
                    <Text style={styles.routeArabicTitle}>{route.nameAr}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedBadge}>
                      <IOSIcon name="check" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <Text style={styles.routeDescription}>{route.description}</Text>

                {/* Metrics Pill Grid */}
                <View style={styles.metricsRow}>
                  <View style={styles.metricPill}>
                    <Text style={styles.metricLabel}>Distance</Text>
                    <Text style={styles.metricValue}>{route.distanceKm} km</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.metricLabel}>Target Pace</Text>
                    <Text style={styles.metricValue}>{route.targetPaceKmH} km/h</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.metricLabel}>Surveyed</Text>
                    <Text style={styles.metricValue}>{route.timesSurveyed} times</Text>
                  </View>
                  <View style={styles.metricPill}>
                    <Text style={styles.metricLabel}>Bonus</Text>
                    <Text style={[styles.metricValue, { color: IOSColors.systemTeal }]}>
                      +{route.bonusXp} XP
                    </Text>
                  </View>
                </View>

                {/* Adoption and Selection Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[
                      styles.adoptBtn,
                      route.isAdopted && styles.adoptBtnActive,
                    ]}
                    onPress={() => {
                      hapticSuccess();
                      toggleAdoptRoute(route.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <IOSIcon
                      name="shield"
                      size={14}
                      color={route.isAdopted ? '#FFFFFF' : IOSColors.systemIndigo}
                    />
                    <Text
                      style={[
                        styles.adoptBtnText,
                        route.isAdopted && styles.adoptBtnTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {route.isAdopted ? 'Adopted' : 'Adopt Route'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.selectBtn,
                      isSelected && styles.selectBtnActive,
                    ]}
                    onPress={() => {
                      hapticButtonPress();
                      onSelectRoute(route);
                      onClose();
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.selectBtnText,
                        isSelected && styles.selectBtnTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {isSelected ? 'Active Route' : 'Select'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredRoutes.length === 0 && filterMode === 'adopted' && (
            <View style={styles.emptyState}>
              <IOSIcon name="shield" size={36} color={IOSColors.systemGray3} />
              <Text style={styles.emptyTitle}>No Adopted Routes Yet</Text>
              <Text style={styles.emptySubtitle}>
                Switch to 'All Transects' and tap 'Adopt Route' to become a Route Guardian and earn repeat-survey bonuses.
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  catalogHeroWrapper: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    height: 140,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0284C7',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  catalogHeroImage: {
    width: '100%',
    height: '100%',
  },
  catalogHeroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.20)',
    justifyContent: 'flex-end',
    padding: 10,
  },
  catalogHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.20)',
  },
  catalogHeroBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.6,
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
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  navBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: IOSColors.systemTeal,
  },
  navTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOSColors.label,
  },
  navRightPlaceholder: {
    width: 48,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerBox: {
    marginBottom: 16,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: IOSColors.label,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subheadline: {
    fontSize: 14,
    color: IOSColors.secondaryLabel,
    lineHeight: 20,
  },
  filterSegment: {
    marginBottom: 18,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routeCardSelected: {
    borderColor: IOSColors.systemTeal,
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  zoneTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoneTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: IOSColors.secondaryLabel,
    letterSpacing: 0.5,
  },
  densityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  densityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  routeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOSColors.label,
  },
  routeArabicTitle: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
  },
  selectedBadge: {
    backgroundColor: IOSColors.systemTeal,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeDescription: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
    lineHeight: 18,
    marginVertical: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  metricPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 10,
    color: IOSColors.tertiaryLabel,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: IOSColors.label,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  adoptBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  adoptBtnActive: {
    backgroundColor: IOSColors.systemIndigo,
    borderColor: IOSColors.systemIndigo,
  },
  adoptBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: IOSColors.systemIndigo,
    textAlign: 'center',
  },
  adoptBtnTextActive: {
    color: '#FFFFFF',
  },
  selectBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  selectBtnActive: {
    backgroundColor: IOSColors.systemTeal,
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: IOSColors.label,
    textAlign: 'center',
  },
  selectBtnTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: IOSColors.label,
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
    lineHeight: 18,
  },
});
