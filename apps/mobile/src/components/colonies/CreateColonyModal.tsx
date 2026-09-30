/**
 * Register a colony or pack (v3): a place where a group of animals lives or is
 * fed. Numbers start empty; nothing is filled in for the volunteer. Colonies
 * are kept on this phone for now.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Switch, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useColoniesStore, type ColonySpecies } from '../../features/colonies/coloniesStore';
import { formatCoordinates } from '../../utils/formatObservation';
import { Button, Card, PageSheet, Segmented, Symbol, Text, useTheme, useToast } from '../../ui';

export function CreateColonyModal({
  visible,
  onClose,
  initialLat,
  initialLon,
}: {
  visible: boolean;
  onClose: () => void;
  initialLat?: number;
  initialLon?: number;
}) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const { addColony } = useColoniesStore();
  const [species, setSpecies] = useState<ColonySpecies>('cat');
  const [name, setName] = useState('');
  const [zone, setZone] = useState('');
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [population, setPopulation] = useState('');
  const [sterilised, setSterilised] = useState('');
  const [water, setWater] = useState(false);
  const [shelter, setShelter] = useState(false);
  const [caretaker, setCaretaker] = useState('');
  const [feeding, setFeeding] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setPos(initialLat != null && initialLon != null ? { lat: initialLat, lon: initialLon } : null);
  }, [visible, initialLat, initialLon]);

  const locate = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          t('ui_createColonyModal.location_permission'),
          t('ui_createColonyModal.gps_permission_is_needed_to_auto')
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setPos({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    } catch {
      Alert.alert(
        t('ui_createColonyModal.gps_error'),
        t('ui_createColonyModal.could_not_obtain_current_location')
      );
    } finally {
      setLocating(false);
    }
  };

  const reset = () => {
    setName('');
    setZone('');
    setPopulation('');
    setSterilised('');
    setWater(false);
    setShelter(false);
    setCaretaker('');
    setFeeding('');
    setNotes('');
  };

  const pop = parseInt(population, 10);
  const ster = parseInt(sterilised, 10);
  const valid = name.trim().length > 0 && pos != null && Number.isFinite(pop) && pop > 0;

  const save = () => {
    if (!valid || !pos) return;
    if (Number.isFinite(ster) && ster > pop) {
      Alert.alert(t('ui_colonies_v3.too_many_title'), t('ui_colonies_v3.too_many_body'));
      return;
    }
    addColony({
      name: name.trim(),
      species,
      zone: zone.trim(),
      latitude: pos.lat,
      longitude: pos.lon,
      estimatedPopulation: pop,
      tnrSterilizedCount: Number.isFinite(ster) ? ster : 0,
      hasWaterStation: water,
      hasShelter: shelter,
      caretakerName: caretaker.trim() || undefined,
      feedingSchedule: feeding.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    useToast
      .getState()
      .show({
        title: t('ui_colonies_v3.saved', { name: name.trim() }),
        detail: t('ui_colonies_v3.saved_detail'),
        icon: 'pin',
      });
    reset();
    onClose();
  };

  const input = {
    backgroundColor: c.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    minHeight: 48,
    fontSize: 17,
    color: c.ink,
  } as const;
  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <View style={{ gap: 6, marginBottom: 18 }}>
      <Text variant="subhead" weight="600">
        {label}
      </Text>
      {el}
      {hint ? (
        <Text variant="footnote" tone="ink2">
          {hint}
        </Text>
      ) : null}
    </View>
  );

  return (
    <PageSheet
      visible={visible}
      title={t('ui_colonies_v3.new_title')}
      onClose={onClose}
      closeLabel={t('common.cancel')}
      footer={
        <Button title={t('ui_colonies_v3.save')} icon="check" disabled={!valid} onPress={save} />
      }
    >
      <Text variant="subhead" tone="ink2" style={{ marginBottom: 18 }}>
        {t('ui_colonies_v3.intro')}
      </Text>

      {field(
        t('ui_colonies_v3.kind'),
        <Segmented
          value={species}
          onChange={setSpecies}
          options={[
            { value: 'cat', label: t('ui_colonies_v3.cats') },
            { value: 'dog', label: t('ui_colonies_v3.dogs') },
            { value: 'mixed', label: t('ui_colonies_v3.mixed') },
          ]}
        />
      )}
      {field(
        t('ui_colonies_v3.name'),
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('ui_colonies_v3.name_placeholder')}
          placeholderTextColor={c.ink3}
          style={input}
          maxLength={60}
          accessibilityLabel={t('ui_colonies_v3.name')}
        />
      )}

      {/* Location */}
      <Card style={{ marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Symbol name="pin" size={22} color={pos ? c.accent : c.warning} />
        <View style={{ flex: 1 }}>
          <Text variant="subhead" weight="600">
            {t('ui_colonies_v3.location')}
          </Text>
          <Text variant="footnote" tone={pos ? 'ink2' : 'ink3'} tabular>
            {pos ? formatCoordinates(pos.lat, pos.lon) : t('ui_colonies_v3.no_location')}
          </Text>
        </View>
        <Button
          kind="secondary"
          size="small"
          icon="locate"
          title={pos ? t('ui_colonies_v3.update') : t('ui_colonies_v3.use_here')}
          loading={locating}
          onPress={locate}
        />
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          {field(
            t('ui_colonies_v3.population'),
            <TextInput
              value={population}
              onChangeText={(v) => setPopulation(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={c.ink3}
              style={input}
              accessibilityLabel={t('ui_colonies_v3.population')}
              maxLength={4}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          {field(
            t('ui_colonies_v3.sterilised'),
            <TextInput
              value={sterilised}
              onChangeText={(v) => setSterilised(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder={t('ui_colonies_v3.unknown')}
              placeholderTextColor={c.ink3}
              style={input}
              accessibilityLabel={t('ui_colonies_v3.sterilised')}
              maxLength={4}
            />
          )}
        </View>
      </View>
      <Text variant="footnote" tone="ink2" style={{ marginTop: -10, marginBottom: 18 }}>
        {t('ui_colonies_v3.count_hint')}
      </Text>

      <Card padded={false} style={{ marginBottom: 18 }}>
        {[
          { label: t('ui_colonies_v3.water'), value: water, set: setWater },
          { label: t('ui_colonies_v3.shelter'), value: shelter, set: setShelter },
        ].map((row, i) => (
          <View
            key={row.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              minHeight: 52,
              borderTopWidth: i ? 0.5 : 0,
              borderTopColor: c.hairline,
            }}
          >
            <Text variant="body" style={{ flex: 1 }}>
              {row.label}
            </Text>
            <Switch
              value={row.value}
              onValueChange={row.set}
              trackColor={{ true: c.accent, false: c.fill }}
              accessibilityLabel={row.label}
            />
          </View>
        ))}
      </Card>

      {field(
        t('ui_colonies_v3.area'),
        <TextInput
          value={zone}
          onChangeText={setZone}
          placeholder={t('ui_colonies_v3.area_placeholder')}
          placeholderTextColor={c.ink3}
          style={input}
          maxLength={60}
          accessibilityLabel={t('ui_colonies_v3.area')}
        />,
        t('ui_profile.optional')
      )}
      {field(
        t('ui_colonies_v3.caretaker'),
        <TextInput
          value={caretaker}
          onChangeText={setCaretaker}
          placeholder={t('ui_colonies_v3.caretaker_placeholder')}
          placeholderTextColor={c.ink3}
          style={input}
          maxLength={60}
          accessibilityLabel={t('ui_colonies_v3.caretaker')}
        />,
        t('ui_colonies_v3.caretaker_hint')
      )}
      {field(
        t('ui_colonies_v3.feeding'),
        <TextInput
          value={feeding}
          onChangeText={setFeeding}
          placeholder={t('ui_colonies_v3.feeding_placeholder')}
          placeholderTextColor={c.ink3}
          style={input}
          maxLength={80}
          accessibilityLabel={t('ui_colonies_v3.feeding')}
        />,
        t('ui_profile.optional')
      )}
      {field(
        t('ui_quick.notes'),
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder={t('ui_quick.notes_placeholder')}
          placeholderTextColor={c.ink3}
          style={[input, { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }]}
          maxLength={500}
          accessibilityLabel={t('ui_quick.notes')}
        />
      )}
    </PageSheet>
  );
}
