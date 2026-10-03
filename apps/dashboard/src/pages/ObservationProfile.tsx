import { useMemo } from 'react';
import { Cat, Compass, PawPrint, ShieldAlert } from 'lucide-react';
import { getGroupAnimals, getObservationDetail, getPhotos, getTrack } from '../data/api';
import { useAnimals, useCore } from '../data/portal';
import { useData } from '../data/useData';
import { compassName, parseTrack } from '../lib/compliance';
import { fmtDateTime, fmtDay, fmtDec, fmtInt, fmtTime } from '../lib/format';
import { href } from '../lib/router';
import { PROTOCOL_LABEL } from '../lib/stats';
import {
  AGE_LABEL,
  BCS_LABEL,
  COAT_LABEL,
  pretty,
  SEX_LABEL,
  SPECIES_LABEL,
  TRISTATE_LABEL,
} from '../lib/labels';
import { useDark } from '../lib/theme';
import { MapView, type MapLine, type MapPoint } from '../components/LazyMap';
import { PersonChip, PhotoTile, SpeciesBadge, StatusBadge } from '../components/widgets';
import {
  Badge,
  Card,
  CardHeader,
  cx,
  EmptyState,
  Facts,
  LinkButton,
  PageHeader,
  Skeleton,
  Table,
  td,
  tdNum,
  th,
} from '../ui';
import type { PageProps } from './types';

function metres(a: [number, number], b: [number, number]) {
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function ObservationProfile({ id }: PageProps) {
  const core = useCore();
  const dark = useDark();
  const { links, individuals } = useAnimals();
  const s = core.sightings.data?.find((x) => x.id === id) ?? null;
  const walk = s ? core.walks.data?.find((w) => w.id === s.session_id) : undefined;
  const detail = useData(`obs:${id}`, () => getObservationDetail(id!));
  const group = useData(`group:${id}`, () => getGroupAnimals(id!));
  const photos = useData(`photos:obs:${id}`, () => getPhotos([id!]));
  const track = useData(`track:${s?.session_id ?? 'none'}`, () =>
    s ? getTrack(s.session_id) : Promise.resolve([])
  );
  const coords = useMemo(() => parseTrack(track.data?.[0]?.track_geojson), [track.data]);
  const link = (links.data ?? []).find((l) => l.observation_id === id && l.status !== 'rejected');
  const animal = link ? individuals.data?.find((i) => i.id === link.individual_id) : undefined;
  const route = walk?.route_id ? core.routes.data?.find((r) => r.id === walk.route_id) : undefined;

  const nearby = useMemo(() => {
    if (!s) return [];
    return (core.sightings.data ?? [])
      .filter((x) => x.id !== s.id && x.species === s.species)
      .map((x) => ({ x, d: metres([s.longitude, s.latitude], [x.longitude, x.latitude]) }))
      .filter((r) => r.d <= 150)
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }, [core.sightings.data, s]);

  if (!core.ready) return <Skeleton className="h-[640px]" />;
  if (!s)
    return (
      <Card>
        <EmptyState
          icon={<PawPrint />}
          title="Sighting not found"
          body="It may have been deleted, or the link is wrong."
          action={<LinkButton href={href('sightings')}>Back to Sightings</LinkButton>}
        />
      </Card>
    );

  const d = detail.data;
  const hasObserver = s.observer_latitude != null && s.observer_longitude != null;
  const points: MapPoint[] = [
    {
      id: s.id,
      lon: s.longitude,
      lat: s.latitude,
      kind: s.species,
      label: `${s.public_code}: animal position`,
    },
    ...(hasObserver
      ? [
          {
            id: 'obs',
            lon: s.observer_longitude!,
            lat: s.observer_latitude!,
            kind: 'observer' as const,
            label: 'Observer position',
          },
        ]
      : []),
    ...nearby.map(({ x }) => ({
      id: x.id,
      lon: x.longitude,
      lat: x.latitude,
      kind: 'unknown' as const,
      label: `${x.public_code} (nearby)`,
      href: `#/sightings/${x.id}`,
    })),
  ];
  const lines: MapLine[] = [
    ...(route?.geometry
      ? [{ id: 'route', coords: route.geometry.coordinates, kind: 'route-muted' as const }]
      : []),
    ...(coords.length ? [{ id: 'track', coords, kind: 'track-muted' as const, arrows: true }] : []),
    ...(hasObserver
      ? [
          {
            id: 'bearing',
            coords: [
              [s.observer_longitude!, s.observer_latitude!],
              [s.longitude, s.latitude],
            ] as [number, number][],
            kind: 'bearing' as const,
          },
        ]
      : []),
  ];
  const sentence = `${s.group_size > 1 ? `A group of ${s.group_size}` : [AGE_LABEL[s.age_class ?? ''] !== 'Not known' ? AGE_LABEL[s.age_class ?? ''] : '', SEX_LABEL[s.sex ?? ''] !== 'Not known' ? SEX_LABEL[s.sex ?? '']?.toLowerCase() : ''].filter(Boolean).join(' ') || 'One'} ${s.group_size > 1 ? `${SPECIES_LABEL[s.species].toLowerCase()}s` : SPECIES_LABEL[s.species].toLowerCase()}, seen by ${s.observer_name || 'an anonymous volunteer'} on ${fmtDay(s.observed_at)} at ${fmtTime(s.observed_at)}.`;
  const healthNone =
    d?.visible_health_issues?.length === 1 && d.visible_health_issues[0] === 'none';

  return (
    <>
      <PageHeader
        back={{ href: href('sightings'), label: 'Sightings' }}
        eyebrow={
          <div className="flex flex-wrap gap-2">
            <SpeciesBadge s={s.species} />
            <Badge>{PROTOCOL_LABEL[s.protocol] ?? s.protocol}</Badge>
            {s.is_welfare_alert ? (
              <Badge tone="danger" dot>
                Welfare alert
              </Badge>
            ) : null}
          </div>
        }
        title={<span translate="no">{s.public_code}</span>}
        description={sentence}
        actions={
          walk ? <LinkButton href={href(`walks/${walk.id}`)}>Open the Walk</LinkButton> : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-4">
            {photos.loading && !photos.data ? (
              <Skeleton className="h-[320px]" />
            ) : photos.data?.length ? (
              <div className={cx('grid gap-3', photos.data.length > 1 ? 'sm:grid-cols-2' : '')}>
                {photos.data.map((p, i) => (
                  <PhotoTile
                    key={p.id}
                    photo={p}
                    label={`${s.public_code} photo ${i + 1}`}
                    className={
                      i === 0 && photos.data!.length !== 2 ? 'h-[340px] sm:col-span-2' : 'h-[220px]'
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={<Cat />}
                title="No photos"
                body="The volunteer did not attach a photo to this record."
              />
            )}
          </Card>
          <Card className="p-2">
            <MapView
              points={points}
              lines={lines}
              dark={dark}
              height={380}
              label="Observer position, bearing line and animal position"
            />
            <p className="px-4 py-3 text-[12px] text-ink2">
              Black dot: where the volunteer stood. Coloured dot: where the animal was, computed
              from the compass bearing and the estimated distance. Grey dots: other{' '}
              {SPECIES_LABEL[s.species].toLowerCase()} sightings within 150 m.
            </p>
          </Card>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <Card className="p-6">
            <PersonChip
              id={s.observer_id}
              name={s.observer_name || 'Anonymous'}
              sub="Recorded this sighting"
              size={44}
            />
            {s.notes ? (
              <div className="mt-4 rounded-tile bg-canvas p-4">
                <p className="text-[12px] text-ink3">Volunteer's note</p>
                <p className="text-[14px] mt-1">{s.notes}</p>
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="The animal" />
            <div className="px-6 pb-6">
              <Facts
                items={[
                  ['Group size', fmtInt(s.group_size)],
                  ['Sex', pretty(s.sex, SEX_LABEL)],
                  ['Age', pretty(s.age_class, AGE_LABEL)],
                  ['Reproductive status', pretty(d?.reproductive_status)],
                  ['Coat', pretty(s.coat_pattern, COAT_LABEL)],
                  ['Ear tip or notch', pretty(s.ear_tip_or_notch, TRISTATE_LABEL)],
                  ['Collar or tag', pretty(d?.collar_or_tag, TRISTATE_LABEL)],
                  ['Behaviour', pretty(d?.behaviour)],
                ]}
              />
              <div className="mt-5">
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[12px] text-ink3">Body condition (ICAM)</p>
                  <p className="text-[14px] font-semibold">
                    {s.body_condition_score
                      ? `${s.body_condition_score} of 5, ${BCS_LABEL[s.body_condition_score]}`
                      : 'Not assessed'}
                  </p>
                </div>
                {s.body_condition_score ? (
                  <div className="grid grid-cols-5 gap-1" aria-hidden>
                    {[1, 2, 3, 4, 5].map((b) => (
                      <span
                        key={b}
                        className={cx(
                          'h-2 rounded-full',
                          b === s.body_condition_score ? 'bg-pill' : 'bg-canvas'
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Health and context" />
            <div className="px-6 pb-6">
              <Facts
                items={[
                  [
                    'Visible health issues',
                    !d
                      ? detail.loading
                        ? 'Loading…'
                        : 'Not recorded'
                      : healthNone
                        ? 'Assessed, none seen'
                        : d.visible_health_issues?.length
                          ? d.visible_health_issues.map((h) => pretty(h)).join(', ')
                          : 'Not assessed',
                  ],
                  ['Fed by people', pretty(d?.being_fed_by_people, TRISTATE_LABEL)],
                  ['Habitat', pretty(d?.habitat_type)],
                  [
                    'Food sources seen',
                    d?.food_sources_visible?.length
                      ? d.food_sources_visible.map((x) => pretty(x)).join(', ')
                      : 'None recorded',
                  ],
                ]}
              />
              {s.is_welfare_alert ? (
                <p className="mt-4 flex items-start gap-2 text-[13px] text-danger">
                  <ShieldAlert aria-hidden className="w-4 h-4 mt-0.5 shrink-0" /> Marked as needing
                  welfare attention.
                </p>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Geometry"
              description="The observer's GPS position is not the animal's position."
            />
            <div className="px-6 pb-6">
              <Facts
                items={[
                  [
                    'Compass bearing',
                    s.bearing_deg != null ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Compass
                          aria-hidden
                          className="w-4 h-4 text-ink3"
                          style={{ transform: `rotate(${s.bearing_deg - 45}deg)` }}
                        />
                        {Math.round(s.bearing_deg)}° {compassName(s.bearing_deg)}
                      </span>
                    ) : (
                      'Not recorded'
                    ),
                  ],
                  [
                    'Estimated distance',
                    s.distance_estimate_m != null
                      ? `${fmtInt(s.distance_estimate_m)} m`
                      : 'Not recorded',
                  ],
                  [
                    'Distance from path',
                    s.perpendicular_distance_m != null
                      ? `${fmtDec(s.perpendicular_distance_m, 1)} m`
                      : 'Not recorded',
                  ],
                  [
                    'GPS accuracy',
                    s.gps_accuracy_m != null ? `${fmtDec(s.gps_accuracy_m, 1)} m` : 'Not recorded',
                  ],
                  [
                    'Animal position',
                    <span className="tabular">{`${fmtDec(s.latitude, 6)}, ${fmtDec(s.longitude, 6)}`}</span>,
                  ],
                  [
                    'Observer position',
                    hasObserver ? (
                      <span className="tabular">{`${fmtDec(s.observer_latitude!, 6)}, ${fmtDec(s.observer_longitude!, 6)}`}</span>
                    ) : (
                      'Not recorded'
                    ),
                  ],
                  ['Location method', pretty(s.location_method)],
                  [
                    'Public grid cell',
                    d?.grid_cell_id ? <span translate="no">{d.grid_cell_id}</span> : 'Not recorded',
                  ],
                ]}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 mt-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Known animal"
            description="Individual re-identification from flank and face photos."
          />
          <div className="px-6 pb-6">
            {animal && link ? (
              <a
                href={href(`animals/${animal.id}`)}
                className="flex items-center gap-4 p-3 -m-3 rounded-tile hover:bg-canvas"
              >
                <PhotoTile
                  photo={
                    animal.photo_path
                      ? {
                          id: 'p',
                          observation_id: '',
                          storage_path: animal.photo_path,
                          angle: 'left_flank',
                        }
                      : undefined
                  }
                  label={animal.nickname || 'Known animal'}
                  className="w-20 h-20"
                  caption={false}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-[17px] font-semibold">
                    {animal.nickname || `Unnamed ${animal.species}`}
                  </span>
                  <span className="block text-[13px] text-ink2">
                    {fmtInt(animal.sightings_count)} confirmed sightings
                    {link.is_founder ? ', registered from this sighting' : ''}
                  </span>
                </span>
                <Badge tone={link.status === 'confirmed' ? 'accent' : 'warn'} dot>
                  {link.status === 'confirmed' ? 'Confirmed' : 'To review'}
                </Badge>
              </a>
            ) : (
              <p className="text-[14px] text-ink2">Not linked to a known animal.</p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Session" />
          <div className="px-6 pb-6">
            {walk ? (
              <a
                href={href(`walks/${walk.id}`)}
                className="flex items-center gap-3 p-3 -m-3 rounded-tile hover:bg-canvas"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] font-semibold">
                    {fmtDateTime(walk.start_time)}
                  </span>
                  <span className="block text-[13px] text-ink2">
                    {PROTOCOL_LABEL[walk.protocol]}
                    {route ? `, ${route.name}` : ''}
                  </span>
                </span>
                <StatusBadge w={walk} />
              </a>
            ) : (
              <p className="text-[14px] text-ink2">Session not loaded.</p>
            )}
            {d ? (
              <p className="text-[12px] text-ink3 mt-4">
                Uploaded {d.synced_at ? fmtDateTime(d.synced_at) : 'at an unknown time'}. Public
                records publish this sighting at a {fmtInt(d.coordinate_uncertainty_m ?? 1000)} m
                grid cell, never the exact point.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      {(group.data?.length ?? 0) > 0 ? (
        <Card className="mt-4">
          <CardHeader
            title="Animals in this group"
            description="Per-animal detail recorded inside the group sighting."
          />
          <Table label="Animals in the group">
            <thead>
              <tr>
                <th className={th}>Animal</th>
                <th className={th}>Sex</th>
                <th className={th}>Age</th>
                <th className={`${th} text-end`}>Condition</th>
                <th className={th}>Ear tip</th>
                <th className={th}>Coat</th>
              </tr>
            </thead>
            <tbody>
              {group.data!.map((g) => (
                <tr key={g.id}>
                  <td className={td}>Number {g.ordinal}</td>
                  <td className={td}>{pretty(g.sex, SEX_LABEL)}</td>
                  <td className={td}>{pretty(g.age_class, AGE_LABEL)}</td>
                  <td className={tdNum}>{g.body_condition_score ?? '-'}</td>
                  <td className={td}>{pretty(g.ear_tip_or_notch, TRISTATE_LABEL)}</td>
                  <td className={td}>{pretty(g.coat_pattern, COAT_LABEL)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      {nearby.length ? (
        <Card className="mt-4">
          <CardHeader
            title="Nearby sightings"
            description={`Other ${SPECIES_LABEL[s.species].toLowerCase()} records within 150 m: candidates for the same animal.`}
          />
          <ul className="px-6 pb-5 grid gap-2 sm:grid-cols-2">
            {nearby.map(({ x, d: dist }) => (
              <li key={x.id}>
                <a
                  href={href(`sightings/${x.id}`)}
                  className="flex items-center gap-3 p-3 rounded-tile bg-canvas hover:brightness-[0.98]"
                >
                  <span className="font-semibold tabular" translate="no">
                    {x.public_code}
                  </span>
                  <span className="text-[13px] text-ink2 flex-1 truncate">
                    {fmtDateTime(x.observed_at)}
                  </span>
                  <span className="text-[13px] tabular text-ink2">{fmtInt(dist)} m</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
