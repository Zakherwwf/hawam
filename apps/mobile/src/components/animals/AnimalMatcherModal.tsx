import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../design-system/tokens';
import { IOSIcon } from '../ios';
import { AnimalProfile } from '../../features/animals/animalsStore';
import { Species } from '@tunisia-survey/shared';
import {
  hapticModalClose,
  hapticButtonPress,
  hapticQuickLog,
  hapticSuccess,
} from '../../utils/haptics';

interface AnimalMatcherModalProps {
  visible: boolean;
  species: Species;
  candidates: AnimalProfile[];
  onSelectNew: () => void;
  onSelectExisting: (animal: AnimalProfile) => void;
  onSelectUnsure: () => void;
  onClose: () => void;
}

export const AnimalMatcherModal: React.FC<AnimalMatcherModalProps> = ({
  visible,
  species,
  candidates,
  onSelectNew,
  onSelectExisting,
  onSelectUnsure,
  onClose,
}) => {
  const { t } = useTranslation();
  const [comparingAnimal, setComparingAnimal] = useState<AnimalProfile | null>(null);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {t('ui_animalMatcherModal.known_animals_nearby')}
              </Text>
              <Text style={styles.modalSubtitle}>
                {candidates.length > 0
                  ? t('ui_animalMatcherModal.found_known_within_300m', {
                      v0: candidates.length,
                      species,
                    })
                  : t('ui_animalMatcherModal.no_previously_recorded_nearby', { species })}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                hapticModalClose();
                onClose();
              }}
              style={styles.closeBtn}
            >
              <IOSIcon name="xmark" size={18} color={DesignTokens.colors.secondaryLabel} />
            </TouchableOpacity>
          </View>

          {/* Candidate Cards List */}
          {candidates.length > 0 ? (
            <View style={styles.scrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cardsScroll}
              >
                {candidates.map((animal) => (
                  <View key={animal.id} style={styles.candidateCard}>
                    <View style={styles.cardImagePlaceholder}>
                      <IOSIcon name="paw" size={28} color={DesignTokens.colors.tint} />
                    </View>

                    <Text style={styles.candidateName}>{animal.nickname}</Text>
                    <Text style={styles.candidateCoat}>
                      {t('ui_animalMatcherModal.coat', { coat_pattern: animal.coat_pattern })}
                    </Text>
                    <Text style={styles.candidateSightings}>
                      {t('ui_animalMatcherModal.prior_sightings', {
                        sightings_count: animal.sightings_count,
                      })}
                    </Text>

                    {animal.colony_name ? (
                      <Text style={styles.candidateColony} numberOfLines={1}>
                        {animal.colony_name}
                      </Text>
                    ) : null}

                    <TouchableOpacity
                      style={styles.selectMatchBtn}
                      onPress={() => {
                        hapticSuccess();
                        onSelectExisting(animal);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.selectMatchBtnText}>
                        {t('ui_animalMatcherModal.same_animal')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
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
          ) : (
            <View style={styles.emptyCandidatesBox}>
              <IOSIcon name="paw" size={32} color={DesignTokens.colors.tertiaryLabel} />
              <Text style={styles.emptyCandidatesText}>
                {t('ui_animalMatcherModal.this_appears_to_be_the_first')}
              </Text>
            </View>
          )}

          {/* Decision Actions */}
          <View style={styles.actionButtonsCol}>
            <TouchableOpacity
              style={[styles.primaryActionBtn, styles.newAnimalBtn]}
              onPress={() => {
                hapticQuickLog();
                onSelectNew();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.primaryActionBtnText} numberOfLines={1} ellipsizeMode="tail">
                {t('ui_animalMatcherModal.register_new_animal')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryActionBtn]}
              onPress={() => {
                hapticButtonPress();
                onSelectUnsure();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryActionBtnText} numberOfLines={1} ellipsizeMode="tail">
                {t('ui_animalMatcherModal.save_for_review')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: DesignTokens.colors.systemBackground,
    borderTopLeftRadius: DesignTokens.radii.xl,
    borderTopRightRadius: DesignTokens.radii.xl,
    paddingTop: DesignTokens.spacing.md,
    paddingBottom: DesignTokens.spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.md,
    marginBottom: DesignTokens.spacing.sm,
  },
  modalTitle: {
    ...DesignTokens.typography.title3,
    color: DesignTokens.colors.label,
  },
  modalSubtitle: {
    ...DesignTokens.typography.footnote,
    color: DesignTokens.colors.secondaryLabel,
  },
  closeBtn: {
    padding: 6,
  },
  scrollWrapper: {
    position: 'relative',
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
  cardsScroll: {
    paddingHorizontal: DesignTokens.spacing.md,
    paddingVertical: DesignTokens.spacing.sm,
    gap: 12,
  },
  candidateCard: {
    width: 170,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: DesignTokens.radii.md,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
    ...DesignTokens.shadows.subtle,
  },
  cardImagePlaceholder: {
    width: '100%',
    height: 90,
    borderRadius: DesignTokens.radii.sm,
    backgroundColor: DesignTokens.colors.tertiarySystemBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  candidateName: {
    ...DesignTokens.typography.headline,
    color: DesignTokens.colors.label,
    fontSize: 14,
  },
  candidateCoat: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.secondaryLabel,
    marginTop: 2,
  },
  candidateSightings: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.tint,
    fontWeight: '700',
    marginTop: 4,
  },
  candidateColony: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.tertiaryLabel,
    marginTop: 2,
  },
  selectMatchBtn: {
    marginTop: 10,
    backgroundColor: DesignTokens.colors.tint,
    paddingVertical: 7,
    borderRadius: DesignTokens.radii.sm,
    alignItems: 'center',
  },
  selectMatchBtnText: {
    ...DesignTokens.typography.caption1,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  emptyCandidatesBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyCandidatesText: {
    ...DesignTokens.typography.footnote,
    color: DesignTokens.colors.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  actionButtonsCol: {
    paddingHorizontal: DesignTokens.spacing.md,
    marginTop: DesignTokens.spacing.md,
    gap: 10,
  },
  primaryActionBtn: {
    height: 48,
    borderRadius: DesignTokens.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newAnimalBtn: {
    backgroundColor: DesignTokens.colors.tint,
  },
  primaryActionBtnText: {
    ...DesignTokens.typography.headline,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryActionBtn: {
    height: 44,
    borderRadius: DesignTokens.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  secondaryActionBtnText: {
    ...DesignTokens.typography.subheadline,
    color: DesignTokens.colors.secondaryLabel,
    fontWeight: '600',
  },
});
