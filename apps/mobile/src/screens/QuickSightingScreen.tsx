/**
 * Quick sighting (v3): one screen, one optional photo, a species, a count and
 * Save. Everything else sits under "More details" and is left 'unknown' unless
 * the volunteer fills it in, so nothing is guessed on their behalf.
 *
 * The observer's GPS fix is taken in the background and shown as a status
 * line; a sighting is never saved at a made-up position (CLAUDE.md 1.4).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type {
  AgeClass,
  BodyConditionScore,
  HealthIssue,
  Sex,
  Species,
  YesNoUnknown,
} from '@tunisia-survey/shared';
import {
  AnimalFace,
  Button,
  Chip,
  Gradient,
  IconButton,
  Press,
  Segmented,
  Symbol,
  Text,
  useCardShadow,
  useTheme,
} from '../ui';
import { quickSightingXp } from '../features/gamification/progress';

export interface QuickSightingPayload {
  species: Species;
  group_size: number;
  sex: Sex;
  age_class: AgeClass;
  ear_tip_or_notch: YesNoUnknown;
  collar_or_tag: YesNoUnknown;
  body_condition_score?: BodyConditionScore;
  visible_health_issues: HealthIssue[];
  notes?: string;
  protocol: 'incidental';
  latitude: number;
  longitude: number;
  gps_accuracy_m?: number;
  observed_at: string;
  photos: { uri: string; angle: 'other'; timestamp: string }[];
}

const HEALTH: HealthIssue[] = [
  'skin_lesions_mange',
  'wound',
  'limp',
  'eye_nose_discharge',
  'tumour',
];
const MAX_GROUP = 50;

export function QuickSightingScreen({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (p: QuickSightingPayload) => void;
}) {
  const { t } = useTranslation();
  const { c, g, dark, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const [photo, setPhoto] = useState<{ uri: string; timestamp: string } | null>(null);
  const [species, setSpecies] = useState<Species | null>(null);
  const [count, setCount] = useState(1);
  const [more, setMore] = useState(false);
  const [sex, setSex] = useState<Sex>('unknown');
  const [age, setAge] = useState<AgeClass>('unknown');
  const [earTip, setEarTip] = useState<YesNoUnknown>('unknown');
  const [collar, setCollar] = useState<YesNoUnknown>('unknown');
  const [bcs, setBcs] = useState<BodyConditionScore | undefined>();
  const [health, setHealth] = useState<HealthIssue[]>([]);
  const [notes, setNotes] = useState('');
  const [fix, setFix] = useState<{ lat: number; lon: number; acc?: number } | null>(null);
  const [gps, setGps] = useState<'finding' | 'ok' | 'denied' | 'failed'>('finding');
  const [saving, setSaving] = useState(false);
  const observedAt = useRef(new Date().toISOString()).current;

  // Watch position while the form is open; keep the most accurate fix
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setGps('denied');
          return;
        }
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000 });
        if (last && !cancelled) {
          setFix({
            lat: last.coords.latitude,
            lon: last.coords.longitude,
            acc: last.coords.accuracy ?? undefined,
          });
          setGps('ok');
        }
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 0 },
          (loc) => {
            if (cancelled) return;
            setFix((prev) => {
              const acc = loc.coords.accuracy ?? undefined;
              if (prev?.acc != null && acc != null && acc > prev.acc) return prev;
              return { lat: loc.coords.latitude, lon: loc.coords.longitude, acc };
            });
            setGps('ok');
          }
        );
      } catch {
        if (!cancelled) setGps((g) => (g === 'ok' ? g : 'failed'));
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  const takePhoto = async (from: 'camera' | 'library') => {
    const perm =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('ui_quick.photo_permission_title'), t('ui_quick.photo_permission_body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('ui_quick.open_settings'), onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.7,
      exif: false,
      allowsEditing: false,
    };
    const res =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(opts)
        : await ImagePicker.launchImageLibraryAsync(opts);
    if (!res.canceled && res.assets?.[0])
      setPhoto({ uri: res.assets[0].uri, timestamp: new Date().toISOString() });
  };

  const save = async () => {
    if (!species) return;
    let f = fix;
    if (!f) {
      setSaving(true);
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        f = {
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
          acc: loc.coords.accuracy ?? undefined,
        };
      } catch {
        f = null;
      }
      setSaving(false);
    }
    if (!f) {
      Alert.alert(t('opportunistic.no_gps_title'), t('opportunistic.no_gps_body'));
      return;
    }
    onSave({
      species,
      group_size: count,
      sex,
      age_class: age,
      ear_tip_or_notch: earTip,
      collar_or_tag: collar,
      body_condition_score: bcs,
      visible_health_issues: health,
      notes: notes.trim() || undefined,
      protocol: 'incidental',
      latitude: f.lat,
      longitude: f.lon,
      gps_accuracy_m: f.acc,
      observed_at: observedAt,
      photos: photo ? [{ uri: photo.uri, angle: 'other', timestamp: photo.timestamp }] : [],
    });
  };

  const xp = quickSightingXp({ animals: count, hasPhoto: !!photo });
  const gpsLine =
    gps === 'ok' && fix
      ? fix.acc != null
        ? t('ui_quick.gps_ok_acc', { m: Math.round(fix.acc) })
        : t('ui_quick.gps_ok')
      : gps === 'denied'
        ? t('ui_quick.gps_denied')
        : gps === 'failed'
          ? t('ui_quick.gps_failed')
          : t('ui_quick.gps_finding');
  const gpsGood = gps === 'ok' && (fix?.acc == null || fix.acc <= 30);

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      {/* Navigation bar */}
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52 + insets.top,
        }}
      >
        <Press
          onPress={onCancel}
          accessibilityLabel={t('common.cancel')}
          style={{ minHeight: 44, minWidth: 64, justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <Text variant="body" tone="accent">
            {t('common.cancel')}
          </Text>
        </Press>
        <Text variant="headline" align="center" style={{ flex: 1 }} accessibilityRole="header">
          {t('ui_record.quick')}
        </Text>
        <View style={{ minWidth: 64 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 24, gap: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. Photo */}
          {photo ? (
            <View
              style={{
                borderRadius: radius.lg,
                overflow: 'hidden',
                aspectRatio: 4 / 3,
                backgroundColor: c.surface,
              }}
            >
              <Image
                source={{ uri: photo.uri }}
                style={{ width: '100%', height: '100%' }}
                accessibilityLabel={t('ui_quick.photo_taken')}
              />
              <View
                style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', gap: 8 }}
              >
                <IconButton
                  icon="camera"
                  label={t('ui_quick.retake')}
                  onPress={() => takePhoto('camera')}
                />
                <IconButton
                  icon="trash"
                  label={t('ui_quick.remove_photo')}
                  onPress={() => setPhoto(null)}
                />
              </View>
            </View>
          ) : (
            <View>
              <Press
                onPress={() => takePhoto('camera')}
                accessibilityLabel={t('ui_quick.take_photo')}
                accessibilityHint={t('ui_quick.photo_hint')}
                style={{ borderRadius: radius.xl, overflow: 'hidden' }}
              >
                <Gradient
                  colors={g.sky}
                  style={{
                    aspectRatio: 16 / 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      borderRadius: 32,
                      backgroundColor: 'rgba(255,255,255,0.75)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.95)',
                    }}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Symbol name="camera" size={28} color={c.accent} weight="semibold" />
                    </View>
                  </View>
                  <Text variant="headline" style={{ color: dark ? c.ink : '#16181D' }}>
                    {t('ui_quick.take_photo')}
                  </Text>
                  <Text variant="footnote" style={{ color: dark ? c.ink2 : '#3A4A55' }}>
                    {t('ui_quick.photo_hint')}
                  </Text>
                </Gradient>
              </Press>
              <Button
                kind="plain"
                size="small"
                icon="photo"
                title={t('ui_quick.from_library')}
                onPress={() => takePhoto('library')}
                style={{ alignSelf: 'center', marginTop: 4 }}
              />
            </View>
          )}

          {/* 2. Species */}
          <View style={{ gap: 10 }}>
            <Text variant="headline" accessibilityRole="header">
              {t('ui_quick.what_did_you_see')}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <SpeciesCard
                species="cat"
                label={t('ui_quick.cat')}
                selected={species === 'cat'}
                color={c.cat}
                soft={c.catSoft}
                onPress={() => setSpecies('cat')}
              />
              <SpeciesCard
                species="dog"
                label={t('ui_quick.dog')}
                selected={species === 'dog'}
                color={c.dog}
                soft={c.dogSoft}
                onPress={() => setSpecies('dog')}
              />
            </View>
            <View style={{ alignSelf: 'flex-start' }}>
              <Chip
                label={t('ui_quick.not_sure')}
                selected={species === 'unknown'}
                onPress={() => setSpecies('unknown')}
              />
            </View>
          </View>

          {/* 3. Count */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: c.surface,
              borderRadius: radius.lg,
              padding: 12,
              paddingStart: 16,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text variant="headline">{t('ui_quick.how_many')}</Text>
              <Text variant="footnote" tone="ink2">
                {t('ui_quick.how_many_hint')}
              </Text>
            </View>
            <IconButton
              icon="minus"
              label={t('ui_quick.fewer')}
              tone="soft"
              onPress={() => setCount((n) => Math.max(1, n - 1))}
            />
            <Text
              variant="title2"
              tabular
              style={{ minWidth: 48 }}
              align="center"
              accessibilityLiveRegion="polite"
              accessibilityLabel={t('ui_quick.count_value', { count })}
            >
              {count}
            </Text>
            <IconButton
              icon="plus"
              label={t('ui_quick.more_animals')}
              tone="soft"
              onPress={() => setCount((n) => Math.min(MAX_GROUP, n + 1))}
            />
          </View>

          {/* 4. Location status */}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}
            accessibilityLiveRegion="polite"
          >
            <Symbol
              name="locate"
              size={16}
              color={gpsGood ? c.accent : c.warning}
              weight="semibold"
            />
            <Text variant="footnote" style={{ color: gpsGood ? c.ink2 : c.warning, flex: 1 }}>
              {gpsLine}
            </Text>
            {gps === 'denied' ? (
              <Button
                kind="plain"
                size="small"
                title={t('ui_quick.open_settings')}
                onPress={() => Linking.openSettings()}
              />
            ) : null}
          </View>

          {/* 5. More details, collapsed */}
          <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            <Press
              onPress={() => setMore((m) => !m)}
              accessibilityState={{ expanded: more }}
              accessibilityLabel={t('ui_quick.more_details')}
              style={{
                minHeight: 52,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="body">{t('ui_quick.more_details')}</Text>
                <Text variant="footnote" tone="ink2">
                  {t('ui_quick.more_details_hint')}
                </Text>
              </View>
              <View style={{ transform: [{ rotate: more ? '90deg' : '0deg' }] }}>
                <Symbol name="chevronRight" size={14} color={c.ink3} weight="semibold" />
              </View>
            </Press>
            {more ? (
              <View style={{ padding: 16, paddingTop: 4, gap: 20 }}>
                <Field label={t('ui_quick.sex')}>
                  <Segmented
                    value={sex}
                    onChange={setSex}
                    options={[
                      { value: 'unknown', label: t('ui_quick.unknown') },
                      { value: 'female', label: t('ui_quick.female') },
                      { value: 'male', label: t('ui_quick.male') },
                    ]}
                  />
                </Field>
                <Field label={t('ui_quick.age')}>
                  <Segmented
                    value={age}
                    onChange={setAge}
                    options={[
                      { value: 'unknown', label: t('ui_quick.unknown') },
                      { value: 'adult', label: t('ui_quick.adult') },
                      { value: 'juvenile', label: t('ui_quick.young') },
                    ]}
                  />
                </Field>
                <Field label={t('ui_quick.ear_tip')} hint={t('ui_quick.ear_tip_hint')}>
                  <TriState value={earTip} onChange={setEarTip} />
                </Field>
                <Field label={t('ui_quick.collar')}>
                  <TriState value={collar} onChange={setCollar} />
                </Field>
                <Field
                  label={t('ui_quick.body')}
                  hint={bcs ? t(`ui_quick.bcs_${bcs}`) : t('ui_quick.bcs_hint')}
                >
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {([1, 2, 3, 4, 5] as BodyConditionScore[]).map((n) => (
                      <Press
                        key={n}
                        onPress={() => setBcs(bcs === n ? undefined : n)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: bcs === n }}
                        accessibilityLabel={`${n}, ${t(`ui_quick.bcs_${n}`)}`}
                        style={{
                          flex: 1,
                          height: 44,
                          borderRadius: radius.sm,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: bcs === n ? c.accent : c.fill,
                        }}
                      >
                        <Text
                          variant="headline"
                          tabular
                          style={{ color: bcs === n ? c.onAccent : c.ink }}
                        >
                          {n}
                        </Text>
                      </Press>
                    ))}
                  </View>
                </Field>
                <Field label={t('ui_quick.health')} hint={t('ui_quick.health_hint')}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {HEALTH.map((h) => (
                      <Chip
                        key={h}
                        label={t(`ui_quick.health_${h}`)}
                        selected={health.includes(h)}
                        onPress={() =>
                          setHealth((cur) =>
                            cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h]
                          )
                        }
                      />
                    ))}
                  </View>
                </Field>
                <Field label={t('ui_quick.notes')}>
                  <TextInput
                    value={notes}
                    onChangeText={setNotes}
                    placeholder={t('ui_quick.notes_placeholder')}
                    placeholderTextColor={c.ink3}
                    multiline
                    maxLength={500}
                    accessibilityLabel={t('ui_quick.notes')}
                    style={{
                      minHeight: 88,
                      borderRadius: radius.sm,
                      backgroundColor: c.fill,
                      padding: 12,
                      fontSize: 17,
                      color: c.ink,
                      textAlignVertical: 'top',
                    }}
                  />
                </Field>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Save */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: Math.max(insets.bottom, 16),
            borderTopWidth: 0.5,
            borderTopColor: c.hairline,
            backgroundColor: c.canvas,
            gap: 8,
          }}
        >
          {species ? (
            <Text variant="footnote" tone="ink2" align="center">
              {t('ui_quick.xp_preview', { xp })}
            </Text>
          ) : (
            <Text variant="footnote" tone="ink2" align="center">
              {t('ui_quick.pick_species')}
            </Text>
          )}
          <Button
            title={t('ui_quick.save')}
            icon="check"
            onPress={save}
            disabled={!species}
            loading={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function SpeciesCard({
  species,
  label,
  selected,
  color,
  soft,
  onPress,
}: {
  species: 'cat' | 'dog';
  label: string;
  selected: boolean;
  color: string;
  soft: string;
  onPress: () => void;
}) {
  const { c, radius } = useTheme();
  const shadow = useCardShadow();
  return (
    <Press
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[
        {
          flex: 1,
          minHeight: 120,
          borderRadius: radius.lg,
          backgroundColor: selected ? soft : c.surface,
          borderWidth: 2,
          borderColor: selected ? color : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        },
        shadow,
      ]}
    >
      <AnimalFace species={species} size={60} />
      <Text variant="headline" style={{ color: selected ? color : c.ink }}>
        {label}
      </Text>
    </Press>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 8 }}>
      <View>
        <Text variant="subhead" weight="600">
          {label}
        </Text>
        {hint ? (
          <Text variant="footnote" tone="ink2">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function TriState({
  value,
  onChange,
}: {
  value: YesNoUnknown;
  onChange: (v: YesNoUnknown) => void;
}) {
  const { t } = useTranslation();
  return (
    <Segmented
      value={value}
      onChange={onChange}
      options={[
        { value: 'unknown', label: t('ui_quick.unknown') },
        { value: 'yes', label: t('common.yes') },
        { value: 'no', label: t('common.no') },
      ]}
    />
  );
}
