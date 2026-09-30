/**
 * Route picker (v3): walk freely, or follow a fixed route. Repeating the same
 * route lets researchers compare counts over time, which is why routes can be
 * adopted. Routes are defined by researchers; the app ships none.
 */

import React, { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoutesStore, type FixedRoute } from '../../features/routes/routesStore';
import { formatObservedAt } from '../../utils/formatObservation';
import {
  Button,
  Card,
  EmptyState,
  PageSheet,
  Press,
  Segmented,
  Symbol,
  Tag,
  Text,
  useCardShadow,
  useTheme,
} from '../../ui';

export function RoutePickerModal({
  visible,
  selectedRouteId,
  onSelectRoute,
  onClose,
}: {
  visible: boolean;
  selectedRouteId: string | null;
  onSelectRoute: (route: FixedRoute | null) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { c, radius } = useTheme();
  const shadow = useCardShadow();
  const { routes, toggleAdoptRoute } = useRoutesStore();
  const [filter, setFilter] = useState<'all' | 'adopted'>('all');
  const shown = routes.filter((r) => filter === 'all' || r.isAdopted);
  const ar = i18n.language?.startsWith('ar');

  const choose = (r: FixedRoute | null) => {
    onSelectRoute(r);
    onClose();
  };

  const freeSelected = selectedRouteId === null;

  return (
    <PageSheet visible={visible} title={t('ui_routes_v3.title')} onClose={onClose}>
      <Text variant="subhead" tone="ink2" style={{ marginBottom: 16 }}>
        {t('ui_routes_v3.intro')}
      </Text>

      <Press
        onPress={() => choose(null)}
        accessibilityRole="radio"
        accessibilityState={{ selected: freeSelected }}
        accessibilityLabel={`${t('ui_walk.free_walk')}. ${t('ui_routes_v3.free_body')}`}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            borderRadius: radius.lg,
            backgroundColor: freeSelected ? c.limeSoft : c.surface,
            borderWidth: 2,
            borderColor: freeSelected ? c.accent : 'transparent',
            marginBottom: 20,
          },
          shadow,
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: c.lime,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Symbol name="walk" size={22} color={c.onLime} weight="semibold" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="headline">{t('ui_walk.free_walk')}</Text>
          <Text variant="footnote" tone="ink2">
            {t('ui_routes_v3.free_body')}
          </Text>
        </View>
        {freeSelected ? <Symbol name="checkCircle" size={24} color={c.accent} /> : null}
      </Press>

      {routes.length > 0 ? (
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('ui_routes_v3.all', { count: routes.length }) },
            {
              value: 'adopted',
              label: t('ui_routes_v3.adopted_tab', {
                count: routes.filter((r) => r.isAdopted).length,
              }),
            },
          ]}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {routes.length === 0 ? (
        <EmptyState
          icon="route"
          title={t('ui_routes_v3.none_title')}
          message={t('ui_routes_v3.none_body')}
        />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="shield"
          title={t('ui_routes_v3.no_adopted_title')}
          message={t('ui_routes_v3.no_adopted_body')}
        />
      ) : (
        <View style={{ gap: 14 }}>
          {shown.map((r) => {
            const selected = r.id === selectedRouteId;
            return (
              <Card
                key={r.id}
                style={{
                  gap: 10,
                  borderWidth: 2,
                  borderColor: selected ? c.accent : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {r.zone ? <Tag label={r.zone} tone="neutral" /> : null}
                  {r.isAdopted ? <Tag label={t('ui_routes_v3.adopted')} /> : null}
                  <View style={{ flex: 1 }} />
                  {selected ? <Symbol name="checkCircle" size={22} color={c.accent} /> : null}
                </View>
                <Text variant="title3">{ar && r.nameAr ? r.nameAr : r.name}</Text>
                {(ar ? r.descriptionAr : r.description) ? (
                  <Text variant="subhead" tone="ink2">
                    {ar && r.descriptionAr ? r.descriptionAr : r.description}
                  </Text>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
                  <Meta icon="ruler" text={t('ui_routes_v3.km', { km: r.distanceKm.toFixed(1) })} />
                  <Meta icon="sync" text={t('ui_routes_v3.walked', { count: r.timesSurveyed })} />
                  {r.lastSurveyedAt ? (
                    <Meta
                      icon="clock"
                      text={formatObservedAt(r.lastSurveyedAt, {
                        today: t('ui_common.today'),
                        yesterday: t('ui_common.yesterday'),
                      })}
                    />
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                  <Button
                    kind="secondary"
                    size="small"
                    icon="shield"
                    title={r.isAdopted ? t('ui_routes_v3.adopted') : t('ui_routes_v3.adopt')}
                    onPress={() => toggleAdoptRoute(r.id)}
                    accessibilityHint={t('ui_routes_v3.adopt_hint')}
                    style={{ flex: 1 }}
                  />
                  <Button
                    size="small"
                    title={selected ? t('ui_routes_v3.selected') : t('ui_routes_v3.walk_this')}
                    onPress={() => choose(r)}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </PageSheet>
  );
}

function Meta({ icon, text }: { icon: 'ruler' | 'sync' | 'clock'; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Symbol name={icon} size={14} color={c.ink3} />
      <Text variant="footnote" tone="ink2" tabular>
        {text}
      </Text>
    </View>
  );
}
