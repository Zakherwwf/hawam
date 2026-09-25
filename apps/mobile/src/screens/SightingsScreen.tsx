import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Species } from '@tunisia-survey/shared';
import { IOSColors, IOSTypography, IOSLayout } from '../theme/ios';
import {
  IOSNavigationBar,
  IOSSegmentedControl,
  IOSButton,
  IOSIcon,
} from '../components/ios';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticTabSwitch,
  hapticQuickLog,
} from '../utils/haptics';

export interface SightingItem {
  id: string;
  species: Species;
  group_size: number;
  distance_from_path_m?: number;
  latitude: number;
  longitude: number;
  observed_at: string;
  body_condition_score?: number;
  protocol: 'transect' | 'stationary_point' | 'incidental';
  health_issues?: string[];
  photos?: string[];
  notes?: string;
  identifier?: string;
  observer_name?: string;
}

interface SightingsScreenProps {
  sightings: SightingItem[];
  onAddNew: () => void;
  onUpdateSighting: (sighting: SightingItem) => void;
  onDeleteSighting: (id: string) => void;
  embedded?: boolean;
}

export const SightingsScreen: React.FC<SightingsScreenProps> = ({
  sightings,
  onAddNew,
  onUpdateSighting,
  onDeleteSighting,
  embedded = false,
}) => {
  const { t } = useTranslation();
  const [filterSpecies, setFilterSpecies] = useState<'all' | 'cat' | 'dog'>('all');
  const [filterOnlyPhotos, setFilterOnlyPhotos] = useState<boolean>(false);
  const [filterTnrOnly, setFilterTnrOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingItem, setEditingItem] = useState<SightingItem | null>(null);

  // Edit form state
  const [editSpecies, setEditSpecies] = useState<Species>('cat');
  const [editGroupSize, setEditGroupSize] = useState<number>(1);
  const [editDistance, setEditDistance] = useState<string>('0');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editIdentifier, setEditIdentifier] = useState<string>('');

  const filtered = sightings.filter((s) => {
    if (filterSpecies !== 'all' && s.species !== filterSpecies) {
      return false;
    }
    if (filterOnlyPhotos && (!s.photos || s.photos.length === 0)) {
      return false;
    }
    if (filterTnrOnly && !s.notes?.toLowerCase().includes('ear') && !s.notes?.toLowerCase().includes('tnr')) {
      return false;
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      const matchNotes = s.notes ? s.notes.toLowerCase().includes(q) : false;
      const matchSpecies = s.species.toLowerCase().includes(q);
      const matchId = s.id.toLowerCase().includes(q);
      const matchIdentifier = s.identifier ? s.identifier.toLowerCase().includes(q) : false;
      return matchNotes || matchSpecies || matchId || matchIdentifier;
    }
    return true;
  });

  const catCount = sightings.filter((s) => s.species === 'cat').length;
  const dogCount = sightings.filter((s) => s.species === 'dog').length;
  const photosCount = sightings.filter((s) => s.photos && s.photos.length > 0).length;
  const tnrCount = sightings.filter((s) => s.notes?.toLowerCase().includes('ear') || s.notes?.toLowerCase().includes('tnr')).length;

  const handleStartEdit = (item: SightingItem) => {
    hapticButtonPress();
    setEditingItem(item);
    setEditSpecies(item.species);
    setEditGroupSize(item.group_size || 1);
    setEditDistance((item.distance_from_path_m ?? 5).toString());
    setEditNotes(item.notes || '');
    setEditIdentifier(item.identifier || '');
  };

  const handleCloseEdit = () => {
    hapticModalClose();
    setEditingItem(null);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    hapticQuickLog();
    const updated: SightingItem = {
      ...editingItem,
      species: editSpecies,
      group_size: editGroupSize,
      distance_from_path_m: parseFloat(editDistance) || 0,
      notes: editNotes,
      identifier: editIdentifier.trim() || undefined,
    };
    onUpdateSighting(updated);
    setEditingItem(null);
  };

  const confirmDelete = (item: SightingItem) => {
    Alert.alert(
      t('sightings.delete_title'),
      t('sightings.delete_prompt'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => onDeleteSighting(item.id),
        },
      ]
    );
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '10:30 AM';
    }
  };

  const ContainerComponent = embedded ? View : SafeAreaView;

  return (
    <View style={styles.outerContainer}>
      <LinearGradient
        colors={['#FDF2EC', '#FAF5EE', '#F3F6F2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ContainerComponent
        style={embedded ? styles.embeddedContainer : styles.safeArea}
        {...(embedded ? {} : { edges: ['top', 'left', 'right'] })}
      >
        {!embedded && (
          <IOSNavigationBar
            title={t('sightings.title')}
            rightAction={
              <TouchableOpacity onPress={onAddNew} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <IOSIcon name="plus" size={22} color={IOSColors.systemTeal} />
              </TouchableOpacity>
            }
          />
        )}

        {/* Search Bar & Species Filter Tabs */}
        <View style={styles.headerControls}>
          <View style={styles.searchBarContainer}>
            <IOSIcon name="search" size={16} color={IOSColors.secondaryLabel} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('sightings.search_placeholder')}
              placeholderTextColor={IOSColors.tertiaryLabel}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IOSIcon name="xmark" size={14} color={IOSColors.secondaryLabel} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.scrollWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  filterSpecies === 'all' && !filterOnlyPhotos && !filterTnrOnly && styles.filterPillActive,
                ]}
                onPress={() => {
                  hapticTabSwitch();
                  setFilterSpecies('all');
                  setFilterOnlyPhotos(false);
                  setFilterTnrOnly(false);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    filterSpecies === 'all' && !filterOnlyPhotos && !filterTnrOnly && styles.filterPillTextActive,
                  ]}
                >
                  {t('sightings.all')} ({sightings.length})
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
                <Text style={[styles.filterPillText, filterSpecies === 'cat' && styles.filterPillTextActive]}>
                  {t('animal.cat')} ({catCount})
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
                <Text style={[styles.filterPillText, filterSpecies === 'dog' && styles.filterPillTextActive]}>
                  {t('animal.dog')} ({dogCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filterOnlyPhotos && styles.filterPillActive]}
                onPress={() => {
                  hapticTabSwitch();
                  setFilterOnlyPhotos(!filterOnlyPhotos);
                }}
                activeOpacity={0.8}
              >
                <IOSIcon
                  name="camera"
                  size={13}
                  color={filterOnlyPhotos ? '#FFFFFF' : '#475569'}
                />
                <Text style={[styles.filterPillText, filterOnlyPhotos && styles.filterPillTextActive]}>
                  Photos ({photosCount})
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
                <Text style={[styles.filterPillText, filterTnrOnly && styles.filterPillTextActive]}>
                  Ear-Tipped ({tnrCount})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Subtle Edge Fade Gradients */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeLeft}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.fadeRight}
              pointerEvents="none"
            />
          </View>
        </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Matches Found' : t('sightings.empty_title')}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No sightings matching "${searchQuery}". Clear search or adjust filter.`
                : t('sightings.empty_subtitle')}
            </Text>
            <View style={{ marginTop: 20 }}>
              {searchQuery ? (
                <IOSButton title="Clear Search" variant="secondary" onPress={() => setSearchQuery('')} />
              ) : (
                <IOSButton title={t('sightings.record_new')} onPress={onAddNew} />
              )}
            </View>
          </View>
        ) : (
          filtered.map((item) => {
            const isCat = item.species === 'cat';
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.speciesBadgeRow}>
                    <View
                      style={[
                        styles.speciesIconBadge,
                        { backgroundColor: isCat ? '#E0F2FE' : '#FEF3C7' },
                      ]}
                    >
                      <Image
                        source={
                          isCat
                            ? require('../../assets/icon_cat_primary.png')
                            : require('../../assets/icon_dog_amber.png')
                        }
                        style={{ width: 18, height: 18, resizeMode: 'contain' }}
                      />
                    </View>
                    <View>
                      <Text style={styles.speciesTitle}>
                        {item.identifier ? item.identifier : (isCat ? t('animal.cat') : t('animal.dog'))}
                        {item.group_size > 1 ? ` (${item.group_size})` : ''}
                      </Text>
                      <Text style={styles.timestampText}>
                        {item.identifier ? `${isCat ? 'Cat' : 'Dog'} • ` : ''}
                        {item.observer_name ? `${item.observer_name} • ` : ''}
                        {formatTime(item.observed_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Actions: Edit & Delete buttons */}
                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      onPress={() => handleStartEdit(item)}
                      style={styles.actionIconButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                    >
                      <IOSIcon name="pencil" size={16} color={IOSColors.systemTeal} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => confirmDelete(item)}
                      style={styles.actionIconButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.6}
                    >
                      <IOSIcon name="trash" size={16} color={IOSColors.systemRed} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Georeference Coordinate Tag */}
                <View style={styles.geoTag}>
                  <IOSIcon name="location" size={13} color={IOSColors.systemTeal} />
                  <Text style={styles.geoCoords}>
                    {item.latitude.toFixed(6)}° N, {item.longitude.toFixed(6)}° E
                  </Text>
                  <Text style={styles.utmBadge}>UTM 32N</Text>
                </View>

                {/* Sighting Details Grid */}
                <View style={styles.detailsGrid}>
                  {item.distance_from_path_m !== undefined ? (
                    <View style={styles.detailPill}>
                      <Text style={styles.detailPillLabel}>{t('sightings.distance_label')}</Text>
                      <Text style={styles.detailPillValue}>{item.distance_from_path_m.toFixed(1)} m</Text>
                    </View>
                  ) : null}

                  {item.body_condition_score ? (
                    <View style={styles.detailPill}>
                      <Text style={styles.detailPillLabel}>{t('sightings.bcs_label')}</Text>
                      <Text style={styles.detailPillValue}>BCS {item.body_condition_score}/5</Text>
                    </View>
                  ) : null}

                  <View style={styles.detailPill}>
                    <Text style={styles.detailPillLabel}>Protocol</Text>
                    <Text style={styles.detailPillValue}>
                      {item.protocol === 'transect'
                        ? 'Transect'
                        : item.protocol === 'stationary_point'
                        ? 'Stationary'
                        : 'Incidental'}
                    </Text>
                  </View>

                  {item.photos && item.photos.length > 0 ? (
                    <View style={[styles.detailPill, { backgroundColor: 'rgba(48, 176, 199, 0.12)' }]}>
                      <IOSIcon name="camera" size={12} color={IOSColors.systemTeal} />
                      <Text style={[styles.detailPillValue, { color: IOSColors.systemTeal }]}>
                        {item.photos.length} Photo{item.photos.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Inline Horizontal Photo Thumbnail Strip */}
                {item.photos && item.photos.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.cardPhotosStrip}
                  >
                    {item.photos.map((photoUri, pIdx) => (
                      <View key={pIdx} style={styles.cardPhotoWrapper}>
                        <Image source={{ uri: photoUri }} style={styles.cardPhotoThumb} />
                        <View style={styles.photoIndexBadge}>
                          <Text style={styles.photoIndexText}>{pIdx + 1}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                {item.notes ? (
                  <Text style={styles.notesText} numberOfLines={2}>
                    "{item.notes}"
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Edit Sighting Modal Sheet */}
      <Modal
        visible={!!editingItem}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEdit}
      >
        <View style={styles.sheetOverlay}>
          <View style={styles.sheetContainer}>
            <View style={IOSLayout.sheetHandle} />
            <Text style={styles.sheetTitle}>{t('survey.edit_detection')}</Text>
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.sheetLabel}>Identifier / Field Tag</Text>
              <TextInput
                style={styles.sheetInput}
                value={editIdentifier}
                onChangeText={setEditIdentifier}
                placeholder="e.g. Rex, White-Flanked Tabby, Ear-Tag #12"
              />
            </View>

            <View style={{ marginBottom: 16 }}>
              <Text style={styles.sheetLabel}>{t('animal.species')}</Text>
              <IOSSegmentedControl<Species>
                selectedValue={editSpecies}
                onValueChange={(val) => {
                  hapticTabSwitch();
                  setEditSpecies(val);
                }}
                values={[
                  { label: t('animal.cat'), value: 'cat' },
                  { label: t('animal.dog'), value: 'dog' },
                ]}
              />
            </View>

            <View style={styles.sheetRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLabel}>{t('animal.group_size')}</Text>
                <View style={styles.stepperBox}>
                  <TouchableOpacity
                    onPress={() => {
                      hapticTabSwitch();
                      setEditGroupSize(Math.max(1, editGroupSize - 1));
                    }}
                    style={styles.stepBtn}
                  >
                    <IOSIcon name="minus" size={14} color={IOSColors.systemTeal} />
                  </TouchableOpacity>
                  <Text style={styles.stepVal}>{editGroupSize}</Text>
                  <TouchableOpacity
                    onPress={() => {
                      hapticTabSwitch();
                      setEditGroupSize(editGroupSize + 1);
                    }}
                    style={styles.stepBtn}
                  >
                    <IOSIcon name="plus" size={14} color={IOSColors.systemTeal} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text style={styles.sheetLabel}>Distance (m)</Text>
                <TextInput
                  style={styles.sheetInput}
                  keyboardType="numeric"
                  value={editDistance}
                  onChangeText={setEditDistance}
                  placeholder="5.0"
                />
              </View>
            </View>

            <View style={{ marginTop: 14 }}>
              <Text style={styles.sheetLabel}>{t('animal.notes')}</Text>
              <TextInput
                style={[styles.sheetInput, { height: 60, textAlignVertical: 'top' }]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Field observations..."
                multiline
              />
            </View>

            <View style={styles.sheetBtnRow}>
              <View style={{ flex: 1 }}>
                <IOSButton
                  title={t('common.cancel')}
                  variant="secondary"
                  onPress={handleCloseEdit}
                />
              </View>
              <View style={{ flex: 1 }}>
                <IOSButton title={t('common.save')} onPress={handleSaveEdit} />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ContainerComponent>
  </View>
);
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#FAF5EE',
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerControls: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(226, 232, 240, 0.8)',
    gap: 8,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    ...IOSTypography.subheadline,
    color: IOSColors.label,
    padding: 0,
  },
  scrollWrapper: {
    position: 'relative',
    marginTop: 4,
  },
  fadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 16,
    zIndex: 2,
  },
  fadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 16,
    zIndex: 2,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 4,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  speciesBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  speciesIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speciesTitle: {
    ...IOSTypography.headline,
  },
  timestampText: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionIconButton: {
    padding: 4,
  },
  geoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IOSColors.systemGray6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  geoCoords: {
    ...IOSTypography.caption2,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontVariant: ['tabular-nums'],
  },
  utmBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: IOSColors.systemTeal,
    backgroundColor: 'rgba(48, 176, 199, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IOSColors.systemGray6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailPillLabel: {
    ...IOSTypography.caption2,
    color: IOSColors.secondaryLabel,
  },
  detailPillValue: {
    ...IOSTypography.caption2,
    fontWeight: '700',
    color: IOSColors.label,
  },
  notesText: {
    ...IOSTypography.footnote,
    color: IOSColors.secondaryLabel,
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIllustration: {
    width: 110,
    height: 110,
    borderRadius: 55,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    ...IOSTypography.title3,
    marginBottom: 6,
  },
  emptySubtitle: {
    ...IOSTypography.subheadline,
    color: IOSColors.secondaryLabel,
    textAlign: 'center',
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
  sheetLabel: {
    ...IOSTypography.caption1,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: IOSColors.systemGray6,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stepBtn: {
    padding: 6,
  },
  stepVal: {
    ...IOSTypography.headline,
    fontWeight: '700',
  },
  sheetInput: {
    backgroundColor: IOSColors.systemGray6,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: IOSColors.label,
  },
  sheetBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  embeddedContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  cardPhotosStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingBottom: 4,
  },
  cardPhotoWrapper: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  cardPhotoThumb: {
    width: 68,
    height: 68,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  photoIndexBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  photoIndexText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D9F944',
  },
});
