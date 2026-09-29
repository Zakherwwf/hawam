import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DesignTokens } from '../design-system/tokens';
import { IOSIcon, IOSNavigationBar, IOSSegmentedControl } from '../components/ios';
import { useAnimalsStore, AnimalProfile } from '../features/animals/animalsStore';
import { Species } from '@tunisia-survey/shared';
import { SightingsScreen, SightingItem } from './SightingsScreen';
import { IOSColors } from '../theme/ios';
import { AnimatedHeroBanner } from '../components/common/AnimatedHeroBanner';
import { hapticTabSwitch, hapticButtonPress } from '../utils/haptics';
import { AnimalDetailModal } from '../components/animals/AnimalDetailModal';

interface AnimalsScreenProps {
  sightings?: SightingItem[];
  onAddNewSighting?: () => void;
  onUpdateSighting?: (sighting: SightingItem) => void;
  onDeleteSighting?: (id: string) => void;
  onSelectAnimal?: (animal: AnimalProfile) => void;
}

export const AnimalsScreen: React.FC<AnimalsScreenProps> = ({
  sightings = [],
  onAddNewSighting,
  onUpdateSighting,
  onDeleteSighting,
  onSelectAnimal,
}) => {
  const { t } = useTranslation();
  const { animals } = useAnimalsStore();

  const [viewMode, setViewMode] = useState<'catalog' | 'sightings'>('catalog');
  const [filterSpecies, setFilterSpecies] = useState<'all' | 'cat' | 'dog'>('all');
  const [filterTnrOnly, setFilterTnrOnly] = useState(false);
  const [filterResightedOnly, setFilterResightedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalProfile | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);

  const filtered = animals.filter((a) => {
    if (filterSpecies !== 'all' && a.species !== filterSpecies) return false;
    if (filterTnrOnly && !a.ear_tipped) return false;
    if (filterResightedOnly && a.sightings_count < 2) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchName = a.nickname.toLowerCase().includes(q);
      const matchCoat = a.coat_pattern.toLowerCase().includes(q);
      const matchColony = a.colony_name ? a.colony_name.toLowerCase().includes(q) : false;
      return matchName || matchCoat || matchColony;
    }
    return true;
  });

  const catCount = animals.filter((a) => a.species === 'cat').length;
  const dogCount = animals.filter((a) => a.species === 'dog').length;
  const tnrCount = animals.filter((a) => a.ear_tipped).length;
  const resightedCount = animals.filter((a) => a.sightings_count >= 2).length;

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {viewMode === 'sightings' ? (
          <IOSNavigationBar
            title={t('ui_animals.field_sightings')}
            rightAction={
              onAddNewSighting ? (
                <TouchableOpacity
                  onPress={onAddNewSighting}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <IOSIcon name="plus" size={22} color={IOSColors.systemTeal} />
                </TouchableOpacity>
              ) : undefined
            }
          />
        ) : null}

        {/* Top View Mode Switcher: Known Catalog vs Field Sightings */}
        <View style={styles.viewModeContainer}>
          <View style={styles.viewModeCapsule}>
            <TouchableOpacity
              style={[styles.viewModeTab, viewMode === 'catalog' && styles.viewModeTabActive]}
              onPress={() => setViewMode('catalog')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.viewModeText, viewMode === 'catalog' && styles.viewModeTextActive]}
              >
                {t('ui_animals.known_individuals', { length: animals.length })}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewModeTab, viewMode === 'sightings' && styles.viewModeTabActive]}
              onPress={() => setViewMode('sightings')}
              activeOpacity={0.8}
            >
              <Text
                style={[styles.viewModeText, viewMode === 'sightings' && styles.viewModeTextActive]}
              >
                {t('ui_animals.all_sightings', { length: sightings.length })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {viewMode === 'sightings' ? (
          <SightingsScreen
            sightings={sightings}
            onAddNew={onAddNewSighting || (() => {})}
            onUpdateSighting={onUpdateSighting || (() => {})}
            onDeleteSighting={onDeleteSighting || (() => {})}
            embedded={true}
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* TripGlide Full-Bleed Video Background Hero */}
            <AnimatedHeroBanner
              height={260}
              variant="backgroundHero"
              scene="cat"
              titleBadge="COMMUNITY COLONY RADAR"
              headline="Feline & Canine Registry"
              subheadline="Catalog of individual street animals with ear-tips & territories"
            />

            {/* Overlapping Content Sheet (TripGlide Pattern) */}
            <View style={styles.overlappingSheet}>
              {/* Search Input - TripGlide Capsule */}
              <View style={styles.searchRow}>
                <View style={styles.searchInputContainer}>
                  <IOSIcon name="search" size={16} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder={t('ui_animals.search_by_nickname_coat_or_colony')}
                    placeholderTextColor="#94A3B8"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <IOSIcon name="xmark" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* TripGlide High-Contrast Filter Pills */}
              <View style={styles.scrollWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterPillsScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.filterPill,
                      filterSpecies === 'all' &&
                        !filterTnrOnly &&
                        !filterResightedOnly &&
                        styles.filterPillActive,
                    ]}
                    onPress={() => {
                      hapticTabSwitch();
                      setFilterSpecies('all');
                      setFilterTnrOnly(false);
                      setFilterResightedOnly(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        filterSpecies === 'all' &&
                          !filterTnrOnly &&
                          !filterResightedOnly &&
                          styles.filterPillTextActive,
                      ]}
                    >
                      {t('ui_animals.all', { length: animals.length })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, filterSpecies === 'cat' && styles.filterPillActive]}
                    onPress={() => {
                      hapticTabSwitch();
                      setFilterSpecies(filterSpecies === 'cat' ? 'all' : 'cat');
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={
                        filterSpecies === 'cat'
                          ? require('../../assets/icon_cat_white.png')
                          : require('../../assets/icon_cat_primary.png')
                      }
                      style={{ width: 14, height: 14, resizeMode: 'contain' }}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        filterSpecies === 'cat' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('ui_animals.cats', { catCount })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, filterSpecies === 'dog' && styles.filterPillActive]}
                    onPress={() => {
                      hapticTabSwitch();
                      setFilterSpecies(filterSpecies === 'dog' ? 'all' : 'dog');
                    }}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={
                        filterSpecies === 'dog'
                          ? require('../../assets/icon_dog_white.png')
                          : require('../../assets/icon_dog_amber.png')
                      }
                      style={{ width: 14, height: 14, resizeMode: 'contain' }}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        filterSpecies === 'dog' && styles.filterPillTextActive,
                      ]}
                    >
                      {t('ui_animals.dogs', { dogCount })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, filterTnrOnly && styles.filterPillActive]}
                    onPress={() => {
                      hapticTabSwitch();
                      setFilterTnrOnly(!filterTnrOnly);
                    }}
                    activeOpacity={0.8}
                  >
                    <IOSIcon
                      name="shield"
                      size={13}
                      color={filterTnrOnly ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      style={[styles.filterPillText, filterTnrOnly && styles.filterPillTextActive]}
                    >
                      {t('ui_animals.ear_tipped', { tnrCount })}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.filterPill, filterResightedOnly && styles.filterPillActive]}
                    onPress={() => {
                      hapticTabSwitch();
                      setFilterResightedOnly(!filterResightedOnly);
                    }}
                    activeOpacity={0.8}
                  >
                    <IOSIcon
                      name="star"
                      size={13}
                      color={filterResightedOnly ? '#FFFFFF' : '#475569'}
                    />
                    <Text
                      style={[
                        styles.filterPillText,
                        filterResightedOnly && styles.filterPillTextActive,
                      ]}
                    >
                      {t('ui_animals.resighted', { resightedCount })}
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

              {/* OxeliaMetrix Stats Strip */}
              <View style={styles.collectionStrip}>
                <View style={styles.stripStat}>
                  <Text style={styles.stripVal}>{animals.length}</Text>
                  <Text style={styles.stripLabel}>{t('ui_animals.registered')}</Text>
                </View>
                <View style={styles.stripDivider} />
                <View style={styles.stripStat}>
                  <Text style={styles.stripVal}>
                    {animals.reduce((acc, a) => acc + a.sightings_count, 0)}
                  </Text>
                  <Text style={styles.stripLabel}>{t('ui_animals.resightings')}</Text>
                </View>
                <View style={styles.stripDivider} />
                <View style={styles.stripStat}>
                  <Text style={styles.stripVal}>{animals.filter((a) => a.ear_tipped).length}</Text>
                  <Text style={styles.stripLabel}>{t('ui_animals.ear_tipped_2')}</Text>
                </View>
              </View>

              {/* Individuals List */}
              {filtered.map((animal) => {
                const isCat = animal.species === 'cat';
                return (
                  <TouchableOpacity
                    key={animal.id}
                    style={styles.animalCard}
                    onPress={() => {
                      hapticButtonPress();
                      setSelectedAnimal(animal);
                      setShowDetailModal(true);
                      if (onSelectAnimal) onSelectAnimal(animal);
                    }}
                    activeOpacity={0.7}
                  >
                    {/* Left Species Icon Badge */}
                    <View
                      style={[
                        styles.speciesIconCircle,
                        {
                          backgroundColor: isCat
                            ? DesignTokens.colors.catLight
                            : DesignTokens.colors.dogLight,
                        },
                      ]}
                    >
                      <Image
                        source={
                          isCat
                            ? require('../../assets/icon_cat_primary.png')
                            : require('../../assets/icon_dog_amber.png')
                        }
                        style={{ width: 24, height: 24, resizeMode: 'contain' }}
                      />
                    </View>

                    {/* Center Info */}
                    <View style={styles.cardCenter}>
                      <View style={styles.nameRow}>
                        <Text style={styles.nicknameText}>{animal.nickname}</Text>
                        {animal.ear_tipped ? (
                          <View style={styles.tnrBadge}>
                            <Text style={styles.tnrBadgeText}>{t('ui_animals.tnr')}</Text>
                          </View>
                        ) : null}
                      </View>

                      <Text style={styles.coatText}>
                        {t('ui_animals.pattern', {
                          coat_pattern: animal.coat_pattern,
                          v3: animal.primary_colour ? ` • ${animal.primary_colour}` : '',
                        })}
                      </Text>

                      {animal.colony_name ? (
                        <Text style={styles.colonyText}>
                          {t('ui_animals.colony', { colony_name: animal.colony_name })}
                        </Text>
                      ) : null}
                    </View>

                    {/* Right Sighting Count Pill & Circular Arrow */}
                    <View style={styles.cardRightCol}>
                      <View style={styles.sightingsPill}>
                        <Text style={styles.sightingsCount}>{animal.sightings_count}</Text>
                        <Text style={styles.sightingsLabel}>{t('ui_animals.sightings')}</Text>
                      </View>
                      <View style={styles.chevronCircle}>
                        <IOSIcon name="chevronRight" size={12} color="#0F172A" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {filtered.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Image
                    source={
                      filterSpecies === 'cat'
                        ? require('../../assets/empty_cat_hills.jpg')
                        : require('../../assets/empty_dog_radar.jpg')
                    }
                    style={styles.emptyIllustration}
                  />
                  <Text style={styles.emptyTitle}>{t('ui_animals.no_animals_found')}</Text>
                  <Text style={styles.emptySubtitle}>
                    {t('ui_animals.log_observations_during_surveys_to_register')}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        )}

        {/* Interactive Animal Dossier Inspector Modal */}
        <AnimalDetailModal
          visible={showDetailModal}
          animal={selectedAnimal}
          onClose={() => setShowDetailModal(false)}
          onLogResighting={() => {
            if (onAddNewSighting) {
              onAddNewSighting();
            }
          }}
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
  overlappingSheet: {
    marginTop: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: 'transparent',
    paddingHorizontal: DesignTokens.spacing.md,
    paddingTop: 14,
    zIndex: 20,
    gap: 10,
  },
  heroContainer: {
    marginTop: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.xs,
  },
  viewModeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  viewModeCapsule: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 22,
    padding: 3,
  },
  viewModeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewModeTabActive: {
    backgroundColor: '#0F172A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  scrollWrapper: {
    position: 'relative',
    marginTop: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.xs,
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
  filterPillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
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
  searchRow: {
    paddingHorizontal: 2,
    paddingVertical: DesignTokens.spacing.xs,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    ...DesignTokens.typography.subheadline,
    color: DesignTokens.colors.label,
    padding: 0,
  },
  collectionStrip: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: DesignTokens.spacing.md,
    marginTop: DesignTokens.spacing.xs,
    marginBottom: DesignTokens.spacing.sm,
    borderRadius: 20,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  stripStat: {
    alignItems: 'center',
  },
  stripVal: {
    ...DesignTokens.typography.headline,
    fontWeight: '800',
    color: DesignTokens.colors.tint,
  },
  stripLabel: {
    ...DesignTokens.typography.caption2,
    fontWeight: '600',
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 2,
  },
  stripDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: DesignTokens.colors.separator,
    height: 28,
  },
  listContent: {
    paddingBottom: 110,
  },
  animalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  speciesIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardCenter: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nicknameText: {
    ...DesignTokens.typography.headline,
    color: DesignTokens.colors.label,
  },
  tnrBadge: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tnrBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: DesignTokens.colors.success,
  },
  coatText: {
    ...DesignTokens.typography.caption1,
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 2,
  },
  colonyText: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.tertiaryLabel,
    marginTop: 2,
    fontStyle: 'italic',
  },
  cardRightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sightingsPill: {
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.systemGroupedBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: DesignTokens.radii.sm,
  },
  sightingsCount: {
    ...DesignTokens.typography.headline,
    fontWeight: '800',
    color: DesignTokens.colors.tint,
  },
  sightingsLabel: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.secondaryLabel,
    fontSize: 9,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyIllustration: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    ...DesignTokens.typography.headline,
    color: DesignTokens.colors.label,
  },
  emptySubtitle: {
    ...DesignTokens.typography.footnote,
    color: DesignTokens.colors.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
