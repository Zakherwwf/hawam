import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { IOSColors, IOSTypography } from '../../theme/ios';

interface IOSSegmentedControlProps<T extends string | number> {
  values: { label: string; value: T }[];
  selectedValue: T;
  onValueChange: (val: T) => void;
}

export function IOSSegmentedControl<T extends string | number>({
  values,
  selectedValue,
  onValueChange,
}: IOSSegmentedControlProps<T>) {
  return (
    <View style={styles.track}>
      {values.map((item) => {
        const isSelected = item.value === selectedValue;
        return (
          <TouchableOpacity
            key={String(item.value)}
            style={[styles.segment, isSelected && styles.segmentSelected]}
            onPress={() => onValueChange(item.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                IOSTypography.subheadline,
                styles.segmentText,
                isSelected && styles.segmentTextSelected,
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: '#E5E5EA', // iOS standard segmented track
    borderRadius: 9,
    padding: 2,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontWeight: '500',
    color: IOSColors.label,
  },
  segmentTextSelected: {
    fontWeight: '600',
    color: '#000000',
  },
});
