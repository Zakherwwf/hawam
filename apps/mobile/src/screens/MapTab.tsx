/**
 * Map tab (v3): everyone's sightings on one full-screen map, a species filter,
 * "near me", and a card for the pin you tap. Recording starts from the tab
 * bar's + button; the map itself stays uncluttered.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { InteractiveMap } from '../components/map/InteractiveMap';
import type { FocusCoordinate, MapMarker, MapStyle } from '../components/map/mapTypes';
import { ColonyInspectorModal } from '../components/colonies/ColonyInspectorModal';
import { CreateColonyModal } from '../components/colonies/CreateColonyModal';
import { useColoniesStore, type CatColony } from '../features/colonies/coloniesStore';
import { useSyncStore } from '../features/sync/syncStore';
import type { SightingItem } from '../app-state/types';
import {
  Button,
  Glass,
  IconButton,
  Press,
  Symbol,
  Tag,
  Text,
  useCardShadow,
  useTabClearance,
  useTheme,
} from '../ui';
import { formatCoordinates, formatObservedAt } from '../utils/formatObservation';

type Layer = 'all' | 'cat' | 'dog' | 'colonies';

export function MapTab({
  sightings,
  onRefresh,
}: {
  sightings: SightingItem[];
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const { c, dark, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const clearance = useTabClearance();
  const pending = useSyncStore((s) => s.pendingCount);
  const { colonies } = useColoniesStore();
  const [layer, setLayer] = useState<Layer>('all');
  const [focus, setFocus] = useState<FocusCoordinate | null>(null);
  const [selected, setSelected] = useState<SightingItem | null>(null);
  const [colony, setColony] = useState<CatColony | null>(null);
  const [creating, setCreating] = useState(false);
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [style, setStyle] = useState<MapStyle>('streets');
  const nextStyle: Record<MapStyle, MapStyle> = {
    streets: 'satellite',
    satellite: 'outdoors',
    outdoors: 'streets',
  };

  const visible = useMemo(
    () =>
      layer === 'colonies'
        ? []
        : sightings.filter((s) => (layer === 'all' ? true : s.species === layer)),
    [sightings, layer]
  );

  const markers: MapMarker[] = useMemo(
    () =>
      visible.map((s) => {
        const code = s.publicCode || t('ui_common.code_pending');
        return {
          id: s.id,
          latitude: s.latitude,
          longitude: s.longitude,
          species: s.species,
          identifier: code,
          label: code,
          title: code,
          distance_from_path_m: s.distance_from_path_m,
        };
      }),
    [visible, t]
  );

  const centerOnMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc =
        (await Location.getLastKnownPositionAsync()) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const p = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setHere(p);
      setFocus({ ...p, zoom: 15 });
    } catch {
      // No fix available; the map stays where it is
    }
  };

  useEffect(() => {
    if (layer !== 'colonies') setColony(null);
  }, [layer]);

  const counts = {
    all: sightings.length,
    cat: sightings.filter((s) => s.species === 'cat').length,
    dog: sightings.filter((s) => s.species === 'dog').length,
    colonies: colonies.length,
  };
  const layers: { key: Layer; label: string; color?: string }[] = [
    { key: 'all', label: t('ui_map_v3.all') },
    { key: 'cat', label: t('ui_map_v3.cats'), color: c.cat },
    { key: 'dog', label: t('ui_map_v3.dogs'), color: c.dog },
    { key: 'colonies', label: t('ui_map_v3.colonies') },
  ];

  const glass = (children: React.ReactNode, style: object) => (
    <View
      style={[
        {
          borderRadius: radius.pill,
          overflow: 'hidden',
          borderWidth: 0.5,
          borderColor: c.hairline,
          backgroundColor: Platform.OS === 'android' ? c.surface : undefined,
        },
        style,
      ]}
    >
      {Platform.OS !== 'android' ? (
        <BlurView
          intensity={80}
          tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.canvas }}>
      <InteractiveMap
        focusCoordinate={focus}
        markers={markers}
        colonyMarkers={
          layer === 'colonies'
            ? colonies.map((col) => ({
                id: col.id,
                name: col.name,
                species: col.species,
                latitude: col.latitude,
                longitude: col.longitude,
                estimatedPopulation: col.estimatedPopulation,
                tnrPercent: Math.round(
                  (col.tnrSterilizedCount / Math.max(1, col.estimatedPopulation)) * 100
                ),
                hasWaterStation: col.hasWaterStation,
                hasShelter: col.hasShelter,
              }))
            : []
        }
        showUserLocation
        hideControls
        mapStyle={style}
        onMarkerPress={(id) => {
          const s = sightings.find((x) => x.id === id);
          if (s) {
            setSelected(s);
            setFocus({ latitude: s.latitude, longitude: s.longitude, zoom: 16 });
          }
        }}
        onColonyPress={(id) => setColony(colonies.find((x) => x.id === id) ?? null)}
        height="100%"
      />

      {/* Layer filter */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 12,
          right: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {glass(
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, gap: 2 }}>
            {layers.map((l) => {
              const on = layer === l.key;
              return (
                <Press
                  key={l.key}
                  onPress={() => {
                    setLayer(l.key);
                    setSelected(null);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${l.label}, ${counts[l.key]}`}
                  style={{
                    minHeight: 36,
                    paddingHorizontal: 12,
                    borderRadius: 18,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: on ? c.accent : 'transparent',
                  }}
                >
                  {l.color ? (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: on ? c.onAccent : l.color,
                      }}
                    />
                  ) : null}
                  <Text variant="subhead" weight="600" style={{ color: on ? c.onAccent : c.ink }}>
                    {l.label}
                  </Text>
                </Press>
              );
            })}
          </View>,
          { flexShrink: 1 }
        )}
      </View>

      {/* Map controls */}
      <View style={{ position: 'absolute', right: 12, top: insets.top + 60, gap: 8 }}>
        <IconButton
          icon="locate"
          tone="glass"
          label={t('ui_mapOverview.near_me')}
          onPress={centerOnMe}
        />
        <IconButton
          icon="layers"
          tone="glass"
          label={t('ui_map_v3.style', { style: t(`ui_map_v3.style_${nextStyle[style]}`) })}
          onPress={() => setStyle(nextStyle[style])}
        />
        {onRefresh ? (
          <IconButton
            icon="sync"
            tone="glass"
            label={t('ui_map_v3.refresh')}
            onPress={onRefresh}
            badge={pending > 0}
          />
        ) : null}
      </View>

      {/* Bottom card: the tapped pin, or what the map shows */}
      <View style={{ position: 'absolute', left: 12, right: 12, bottom: clearance - 12 }}>
        {selected ? (
          <PinCard s={selected} onClose={() => setSelected(null)} />
        ) : layer === 'colonies' ? (
          <Button
            title={t('ui_map_v3.register_colony')}
            icon="plus"
            onPress={async () => {
              await centerOnMe();
              setCreating(true);
            }}
          />
        ) : (
          glass(
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                minHeight: 44,
              }}
            >
              <Symbol name="pin" size={16} color={c.accent} weight="semibold" />
              <Text variant="subhead" style={{ flex: 1 }} numberOfLines={1}>
                {visible.length > 0
                  ? t('ui_map_v3.showing', { count: visible.length })
                  : t('ui_map_v3.nothing')}
              </Text>
            </View>,
            { alignSelf: 'center' }
          )
        )}
      </View>

      <ColonyInspectorModal visible={!!colony} colony={colony} onClose={() => setColony(null)} />
      <CreateColonyModal
        visible={creating}
        onClose={() => setCreating(false)}
        initialLat={here?.latitude ?? focus?.latitude}
        initialLon={here?.longitude ?? focus?.longitude}
      />
    </View>
  );
}

/** The card for a tapped pin: species tag, code, then labelled detail rows. */
function PinCard({ s, onClose }: { s: SightingItem; onClose: () => void }) {
  const { t } = useTranslation();
  const { c, radius } = useTheme();
  const shadow = useCardShadow();
  const species =
    s.species === 'cat'
      ? t('ui_quick.cat')
      : s.species === 'dog'
        ? t('ui_quick.dog')
        : t('ui_sightings_v3.animal');
  const detail = (icon: 'clock' | 'pin' | 'profile' | 'paw', text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Symbol name={icon} size={15} color={c.ink3} />
      <Text variant="footnote" tone="ink2" tabular numberOfLines={1} style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
  return (
    <Glass intensity={60} style={[{ borderRadius: radius.xl }, shadow]}>
      <View style={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ flex: 1, gap: 8 }}>
            <Tag
              label={species}
              tone={s.species === 'cat' ? 'cat' : s.species === 'dog' ? 'dog' : 'neutral'}
            />
            <Text variant="title2" tabular>
              {s.publicCode || t('ui_common.code_pending')}
            </Text>
          </View>
          <IconButton icon="close" label={t('ui_common.close')} tone="soft" onPress={onClose} />
        </View>
        <View style={{ gap: 6 }}>
          {detail('paw', t('ui_quick.count_value', { count: s.group_size || 1 }))}
          {detail(
            'clock',
            formatObservedAt(s.observed_at, {
              today: t('ui_common.today'),
              yesterday: t('ui_common.yesterday'),
            })
          )}
          {detail('pin', formatCoordinates(s.latitude, s.longitude))}
          {s.observer_name
            ? detail('profile', t('ui_map_v3.seen_by', { name: s.observer_name }))
            : null}
        </View>
      </View>
    </Glass>
  );
}
