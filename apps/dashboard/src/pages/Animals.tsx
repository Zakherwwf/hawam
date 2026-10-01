import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, PawPrint } from 'lucide-react';
import {
  getIndividuals,
  getLinks,
  getPhotos,
  getSightings,
  photoUrl,
  reviewLink,
  type Individual,
  type Link,
  type Photo,
} from '../data/api';
import { invalidate, useData } from '../data/useData';
import { fmtDate, fmtDateTime, fmtInt } from '../lib/format';
import { setParam } from '../lib/router';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Segmented,
  Skeleton,
  Table,
  td,
  tdNum,
  th,
} from '../ui';
import type { PageProps } from './types';

const COAT: Record<string, string> = {
  tabby: 'Tabby',
  bicolour_piebald: 'Two colours',
  tortoiseshell_calico: 'Tortoiseshell or calico',
  solid_black: 'All black',
  solid_other: 'One colour',
  other: 'Other',
};
const SIDE: Record<string, string> = {
  left_flank: 'Left side',
  right_flank: 'Right side',
  face: 'Face',
  other: 'Other view',
};
const animalName = (i?: Individual) =>
  i?.nickname || (i ? `Unnamed ${i.species}` : 'Unknown animal');

function metres(a: [number, number], b: [number, number]) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function Animals({ params }: PageProps) {
  const view = (params.get('view') as 'review' | 'all') || 'review';
  const individuals = useData('individuals', getIndividuals);
  const links = useData('links', getLinks);
  const sightings = useData('sightings', getSightings);
  const queue = useMemo(
    () =>
      (links.data ?? [])
        .filter((l) => l.status === 'proposed')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [links.data]
  );
  const error = individuals.error || links.error || sightings.error;

  return (
    <>
      <PageHeader
        title="Animals"
        description="Individual animals volunteers follow. Confirm each resighting before it counts in capture histories."
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={(v) => setParam('view', v === 'review' ? undefined : v)}
            options={[
              { value: 'review', label: `To review (${fmtInt(queue.length)})` },
              { value: 'all', label: `All animals (${fmtInt(individuals.data?.length ?? 0)})` },
            ]}
          />
        }
      />
      {error ? <ErrorNote message={error} /> : null}
      {view === 'review' ? (
        <ReviewQueue
          queue={queue}
          individuals={individuals.data}
          sightings={sightings.data}
          loading={!links.data || !individuals.data || !sightings.data}
        />
      ) : (
        <AllAnimals individuals={individuals.data} />
      )}
    </>
  );
}

function ReviewQueue({
  queue,
  individuals,
  sightings,
  loading,
}: {
  queue: Link[];
  individuals?: Individual[];
  sightings?: import('../data/api').Sighting[];
  loading: boolean;
}) {
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const allLinks = useData('links', getLinks);
  const pending = queue.filter((l) => !skipped.has(l.id));
  const current = pending[0];
  const ind = individuals?.find((i) => i.id === current?.individual_id);
  const obs = sightings?.find((s) => s.id === current?.observation_id);
  const refObsIds = useMemo(
    () =>
      (allLinks.data ?? [])
        .filter((l) => l.individual_id === current?.individual_id && l.status === 'confirmed')
        .map((l) => l.observation_id),
    [allLinks.data, current?.individual_id]
  );
  const photos = useData(`photos:${current?.id ?? 'none'}`, () =>
    getPhotos(current ? [current.observation_id, ...refObsIds] : [])
  );

  if (loading) return <Skeleton className="h-[420px]" />;
  if (!current) {
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 />}
          title={done ? `All caught up: ${fmtInt(done)} reviewed` : 'Nothing to review'}
          body="When volunteers say a sighting is an animal someone already follows, it appears here to confirm or reject."
        />
      </Card>
    );
  }

  const newPhoto = photos.data?.find((p) => p.observation_id === current.observation_id);
  const refs = (photos.data ?? [])
    .filter((p) => p.observation_id !== current.observation_id)
    .sort((a, b) => Number(b.angle === newPhoto?.angle) - Number(a.angle === newPhoto?.angle))
    .slice(0, 3);
  const distance =
    obs && ind?.latitude != null && ind.longitude != null
      ? Math.round(metres([obs.latitude, obs.longitude], [ind.latitude, ind.longitude]))
      : null;

  const decide = async (status: 'confirmed' | 'rejected') => {
    setBusy(true);
    try {
      await reviewLink(current.id, status);
      setDone((d) => d + 1);
      invalidate('links');
      invalidate('individuals');
      await allLinks.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <p className="text-[14px] text-ink2 flex-1" aria-live="polite">
          {fmtInt(pending.length)} waiting{done ? `, ${fmtInt(done)} reviewed this visit` : ''}
        </p>
        <Badge tone={current.decision === 'unsure' ? 'warn' : 'accent'}>
          {current.decision === 'unsure' ? 'Volunteer not sure' : 'Volunteer sure'}
        </Badge>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="New sighting" className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">New sighting</h2>
          <PhotoTile photo={newPhoto} label="Photo of the new sighting" large />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <Fact k="Record" v={obs?.public_code ?? '-'} mono />
            <Fact k="Seen" v={obs ? fmtDateTime(obs.observed_at) : '-'} />
            <Fact k="By" v={obs?.observer_name || 'Anonymous'} />
            <Fact k="From last position" v={distance != null ? `${fmtInt(distance)} m` : '-'} />
          </dl>
        </section>
        <section aria-label={`Known animal ${animalName(ind)}`} className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">
            {animalName(ind)}
            <span className="text-ink2 font-normal">
              {ind?.coat_pattern ? `, ${COAT[ind.coat_pattern] ?? ind.coat_pattern}` : ''}
            </span>
          </h2>
          <PhotoTile photo={refs[0]} label={`Reference photo of ${animalName(ind)}`} large />
          <div className="grid grid-cols-2 gap-3">
            {refs.slice(1).map((p) => (
              <PhotoTile key={p.id} photo={p} label={`Another photo of ${animalName(ind)}`} />
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            <Fact k="Confirmed sightings" v={fmtInt(refObsIds.length)} />
            <Fact k="Last seen" v={ind?.last_seen ? fmtDate(ind.last_seen) : '-'} />
          </dl>
        </section>
      </div>
      <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-line">
        <Button disabled={busy} onClick={() => decide('confirmed')}>
          Same Animal
        </Button>
        <Button kind="danger" disabled={busy} onClick={() => decide('rejected')}>
          Different Animal
        </Button>
        <Button
          kind="ghost"
          disabled={busy}
          onClick={() => setSkipped((s) => new Set(s).add(current.id))}
        >
          Skip for Now
        </Button>
      </div>
    </Card>
  );
}

function Fact({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] text-ink3">{k}</dt>
      <dd
        className={`truncate ${mono ? 'tabular font-medium' : ''}`}
        translate={mono ? 'no' : undefined}
      >
        {v}
      </dd>
    </div>
  );
}

function PhotoTile({ photo, label, large }: { photo?: Photo; label: string; large?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (photo) photoUrl(photo.storage_path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [photo?.storage_path]);
  // Large tiles are capped so the decision buttons stay in view
  const h = large ? 'h-[260px]' : 'h-[120px]';
  return (
    <figure className="m-0">
      <div
        className={`${h} w-full rounded-control bg-fill overflow-hidden grid place-items-center`}
      >
        {url ? (
          <img
            src={url}
            alt={label}
            width={480}
            height={360}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-[13px] text-ink3">{photo ? 'Loading photo…' : 'No photo'}</span>
        )}
      </div>
      {photo ? (
        <figcaption className="text-[12px] text-ink2 mt-1">{SIDE[photo.angle]}</figcaption>
      ) : null}
    </figure>
  );
}

function AllAnimals({ individuals }: { individuals?: Individual[] }) {
  if (!individuals) return <Skeleton className="h-[320px]" />;
  if (!individuals.length)
    return (
      <Card>
        <EmptyState
          icon={<PawPrint />}
          title="No animals registered yet"
          body="Volunteers register an animal in the app with New animal to follow."
        />
      </Card>
    );
  return (
    <Card>
      <Table label="Known animals">
        <thead>
          <tr>
            <th className={th}>Animal</th>
            <th className={th}>Species</th>
            <th className={th}>Coat</th>
            <th className={`${th} text-right`}>Sightings</th>
            <th className={th}>First seen</th>
            <th className={th}>Last seen</th>
            <th className={th}>Side photos</th>
            <th className={`${th} text-right`}>To review</th>
          </tr>
        </thead>
        <tbody>
          {individuals.map((i) => (
            <tr key={i.id} className="hover:bg-canvas">
              <td className={`${td} font-medium`}>{animalName(i)}</td>
              <td className={td}>
                <Badge tone={i.species === 'cat' ? 'cat' : i.species === 'dog' ? 'dog' : 'neutral'}>
                  {i.species}
                </Badge>
              </td>
              <td className={`${td} text-ink2`}>
                {i.coat_pattern ? (COAT[i.coat_pattern] ?? i.coat_pattern) : '-'}
              </td>
              <td className={tdNum}>{fmtInt(i.sightings_count)}</td>
              <td className={`${td} text-ink2 whitespace-nowrap`}>
                {i.first_seen ? fmtDate(i.first_seen) : '-'}
              </td>
              <td className={`${td} text-ink2 whitespace-nowrap`}>
                {i.last_seen ? fmtDate(i.last_seen) : '-'}
              </td>
              <td className={`${td} text-ink2`}>
                {[i.has_left_flank && 'Left', i.has_right_flank && 'Right']
                  .filter(Boolean)
                  .join(', ') || 'None yet'}
              </td>
              <td className={tdNum}>
                {i.pending_links ? <Badge tone="warn">{fmtInt(i.pending_links)}</Badge> : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
