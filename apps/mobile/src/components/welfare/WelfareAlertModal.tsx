import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { DesignTokens } from '../../design-system/tokens';
import { IOSIcon } from '../ios';
import { Species } from '@tunisia-survey/shared';

interface WelfareAlertModalProps {
  visible: boolean;
  species: Species;
  latitude: number;
  longitude: number;
  onSubmitAlert: (data: {
    issues: string[];
    urgency: 'critical' | 'urgent' | 'moderate';
    notes: string;
  }) => void;
  onClose: () => void;
}

const WELFARE_ISSUES = [
  { id: 'wound', label: 'Severe Open Wound' },
  { id: 'skin_lesions_mange', label: 'Severe Mange / Alopecia' },
  { id: 'limp', label: 'Severe Mobility Impairment / Fractured Limb' },
  { id: 'emaciation', label: 'Critical Emaciation (BCS 1)' },
  { id: 'eye_nose_discharge', label: 'Purulent Ocular/Nasal Discharge' },
];

export const WelfareAlertModal: React.FC<WelfareAlertModalProps> = ({
  visible,
  species,
  latitude,
  longitude,
  onSubmitAlert,
  onClose,
}) => {
  const [selectedIssues, setSelectedIssues] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<'critical' | 'urgent' | 'moderate'>('urgent');
  const [notes, setNotes] = useState('');

  const toggleIssue = (id: string) => {
    if (selectedIssues.includes(id)) {
      setSelectedIssues(selectedIssues.filter((i) => i !== id));
    } else {
      setSelectedIssues([...selectedIssues, id]);
    }
  };

  const handleSubmit = () => {
    onSubmitAlert({
      issues: selectedIssues,
      urgency,
      notes,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <View style={styles.alertIconCircle}>
                <IOSIcon name="shield" size={18} color={DesignTokens.colors.welfareAlert} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Welfare Emergency Alert</Text>
                <Text style={styles.modalSubtitle}>
                  Flag injured or distressed {species} for partner NGOs
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <IOSIcon name="xmark" size={18} color={DesignTokens.colors.secondaryLabel} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Urgency Selector */}
            <Text style={styles.sectionHeader}>TRIAGE URGENCY LEVEL</Text>
            <View style={styles.urgencyRow}>
              {(['moderate', 'urgent', 'critical'] as const).map((u) => {
                const isSelected = urgency === u;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[styles.urgencyChip, isSelected && styles.urgencyChipActive]}
                    onPress={() => setUrgency(u)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.urgencyChipText,
                        isSelected && styles.urgencyChipTextActive,
                      ]}
                    >
                      {u.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Observed Conditions Checklist */}
            <Text style={styles.sectionHeader}>OBSERVED HEALTH ISSUES</Text>
            <View style={styles.issuesList}>
              {WELFARE_ISSUES.map((issue) => {
                const isChecked = selectedIssues.includes(issue.id);
                return (
                  <TouchableOpacity
                    key={issue.id}
                    style={[styles.issueRow, isChecked && styles.issueRowChecked]}
                    onPress={() => toggleIssue(issue.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                      {isChecked ? <IOSIcon name="check" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={styles.issueText}>{issue.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Field Notes */}
            <Text style={styles.sectionHeader}>SPECIFIC LOCATION & OBSERVATIONS</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. Hidden under green truck, bleeding from front paw..."
              placeholderTextColor={DesignTokens.colors.tertiaryLabel}
              multiline
              numberOfLines={3}
            />

            <View style={styles.coordsTag}>
              <IOSIcon name="location" size={12} color={DesignTokens.colors.secondaryLabel} />
              <Text style={styles.coordsText}>
                Coordinates: {latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitAlertBtn,
                selectedIssues.length === 0 && { opacity: 0.6 },
              ]}
              onPress={handleSubmit}
              disabled={selectedIssues.length === 0}
              activeOpacity={0.7}
            >
              <Text style={styles.submitAlertBtnText} numberOfLines={1}>Submit Welfare Alert</Text>
            </TouchableOpacity>
          </ScrollView>
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
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DesignTokens.spacing.md,
    marginBottom: DesignTokens.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DesignTokens.colors.welfareAlertLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    ...DesignTokens.typography.title3,
    color: DesignTokens.colors.welfareAlert,
    fontWeight: '700',
  },
  modalSubtitle: {
    ...DesignTokens.typography.footnote,
    color: DesignTokens.colors.secondaryLabel,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    paddingHorizontal: DesignTokens.spacing.md,
    paddingTop: DesignTokens.spacing.sm,
  },
  sectionHeader: {
    ...DesignTokens.typography.caption2,
    fontWeight: '700',
    color: DesignTokens.colors.secondaryLabel,
    letterSpacing: 0.5,
    marginTop: DesignTokens.spacing.md,
    marginBottom: DesignTokens.spacing.xs,
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urgencyChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: DesignTokens.radii.sm,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
    alignItems: 'center',
  },
  urgencyChipActive: {
    backgroundColor: DesignTokens.colors.welfareAlert,
    borderColor: DesignTokens.colors.welfareAlert,
  },
  urgencyChipText: {
    ...DesignTokens.typography.caption2,
    fontWeight: '700',
    color: DesignTokens.colors.label,
  },
  urgencyChipTextActive: {
    color: '#FFFFFF',
  },
  issuesList: {
    gap: 6,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    padding: 12,
    borderRadius: DesignTokens.radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
  },
  issueRowChecked: {
    borderColor: DesignTokens.colors.welfareAlert,
    backgroundColor: 'rgba(220, 38, 38, 0.04)',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: DesignTokens.colors.tertiaryLabel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: DesignTokens.colors.welfareAlert,
    borderColor: DesignTokens.colors.welfareAlert,
  },
  issueText: {
    ...DesignTokens.typography.subheadline,
    color: DesignTokens.colors.label,
    flex: 1,
  },
  notesInput: {
    backgroundColor: DesignTokens.colors.secondarySystemGroupedBackground,
    borderRadius: DesignTokens.radii.sm,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: DesignTokens.colors.separator,
    ...DesignTokens.typography.body,
    color: DesignTokens.colors.label,
    textAlignVertical: 'top',
  },
  coordsTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: DesignTokens.spacing.md,
  },
  coordsText: {
    ...DesignTokens.typography.caption2,
    color: DesignTokens.colors.secondaryLabel,
    fontVariant: ['tabular-nums'],
  },
  submitAlertBtn: {
    backgroundColor: DesignTokens.colors.welfareAlert,
    height: 48,
    borderRadius: DesignTokens.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: DesignTokens.spacing.sm,
    marginBottom: DesignTokens.spacing.lg,
  },
  submitAlertBtnText: {
    ...DesignTokens.typography.headline,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
