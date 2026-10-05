import { useMemo, useState } from 'react';
import { CheckCircle2, PawPrint, Search } from 'lucide-react';
import {
  getLinks,
  getPhotos,
  reviewLink,
  type Individual,
  type Link,
  type Sighting,
} from '../data/api';
import { useAnimals, useCore } from '../data/portal';
import { invalidate, useData } from '../data/useData';
import { fmtAgo, fmtDate, fmtDateTime, fmtInt } from '../lib/format';
import { href, setParam } from '../lib/router';
import { COAT_LABEL, SPECIES_LABEL } from '../lib/labels';
import { PhotoTile } from '../components/widgets';
import {
  Badge,
  Button,
  Card,
  cx,
  EmptyState,
  ErrorNote,
  Facts,
  inputClass,
  PageHeader,
  Segmented,
  Skeleton,
  Tabs,
} from '../ui';
import type { PageProps } from './types';

export const animalName = (i?: Individual) =>
  i?.nickname || (i ? `Unnamed ${i.species}` : 'Unknown animal');

export function metres(a: [number, number], b: [number, number]) {
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function Animals({ params }: PageProps) {
  const view = (params.get('view') as 'review' | 'all') || 'review';
  const { individuals, links } = useAnimals();
  const core = useCore();
  const queue = useMemo(
    () =>
      (links.data ?? [])
        .filter((l) => l.status === 'proposed')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [links.data]
  );
  const error = individuals.error || links.error || core.error;

  return (
    <>
      <PageHeader
        title="Animals"
        description="Individual animals volunteers follow. Confirm each resighting before it counts in capture histories."
      />
      <div className="mb-5">
        <Tabs
          label="Animal views"
          items={[
            {
              href: href('animals'),
              label: 'To Review',
              active: view === 'review',
              count: queue.length,
            },
            {
              href: href('animals', { view: 'all' }),
              label: 'Known Animals',
              active: view === 'all',
              count: individuals.data?.length ?? 0,
            },
          ]}
        />
      </div>
      {error ? <ErrorNote message={error} /> : null}
      {view === 'review' ? (
        <ReviewQueue
          queue={queue}
          individuals={individuals.data}
          sightings={core.sightings.data}
          loading={!links.data || !individuals.data || !core.sightings.data}
        />
      ) : (
        <AnimalGrid params={params} individuals={individuals.data} links={links.data} />
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
  sightings?: Sighting[];
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

  if (loading) return <Skeleton className="h-[480px]" />;
  if (!current)
    return (
      <Card>
        <EmptyState
          icon={<CheckCircle2 />}
          title={done ? `All caught up: ${fmtInt(done)} reviewed` : 'Nothing to review'}
          body="When volunteers say a sighting is an animal someone already follows, it appears here to confirm or reject."
        />
      </Card>
    );

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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <p className="text-[14px] text-ink2 flex-1" aria-live="polite">
            {fmtInt(pending.length)} waiting{done ? `, ${fmtInt(done)} reviewed this visit` : ''}
          </p>
          <Badge tone={current.decision === 'unsure' ? 'warn' : 'accent'} dot>
            {current.decision === 'unsure' ? 'Volunteer not sure' : 'Volunteer sure'}
          </Badge>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label="New sighting" className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold">New sighting</h2>
            <PhotoTile photo={newPhoto} label="Photo of the new sighting" className="h-[300px]" />
            <Facts
              items={[
                [
                  'Record',
                  obs ? (
                    <a
                      href={href(`sightings/${obs.id}`)}
                      className="font-semibold hover:underline"
                      translate="no"
                    >
                      {obs.public_code}
                    </a>
                  ) : (
                    '-'
                  ),
                ],
                ['Seen', obs ? fmtDateTime(obs.observed_at) : '-'],
                ['By', obs?.observer_name || 'Anonymous'],
                ['From last known position', distance != null ? `${fmtInt(distance)} m` : '-'],
              ]}
            />
          </section>
          <section aria-label={`Known animal ${animalName(ind)}`} className="flex flex-col gap-3">
            <h2 className="text-[17px] font-semibold">
              <a href={href(`animals/${ind?.id}`)} className="hover:underline">
                {animalName(ind)}
              </a>
              <span className="text-ink2 font-normal">
                {ind?.coat_pattern ? `, ${COAT_LABEL[ind.coat_pattern] ?? ind.coat_pattern}` : ''}
              </span>
            </h2>
            <PhotoTile
              photo={refs[0]}
              label={`Reference photo of ${animalName(ind)}`}
              className="h-[300px]"
            />
            <div className="grid grid-cols-2 gap-3">
              {refs.slice(1).map((p) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  label={`Another photo of ${animalName(ind)}`}
                  className="h-[110px]"
                />
              ))}
            </div>
            <Facts
              items={[
                ['Confirmed sightings', fmtInt(refObsIds.length)],
                ['Last seen', ind?.last_seen ? fmtDate(ind.last_seen) : '-'],
              ]}
            />
          </section>
        </div>
        <div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-line">
          <Button kind="dark" disabled={busy} onClick={() => decide('confirmed')}>
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
      <Card as="aside" className="p-5 self-start">
        <h2 className="text-[15px] font-semibold mb-3">Up next</h2>
        <ol className="flex flex-col gap-2">
          {pending.slice(1, 7).map((l) => {
            const a = individuals?.find((i) => i.id === l.individual_id);
            const o = sightings?.find((s) => s.id === l.observation_id);
            return (
              <li key={l.id} className="flex items-center gap-3 p-2 rounded-[12px] bg-canvas">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-medium truncate">{animalName(a)}</span>
                  <span className="block text-[12px] text-ink2 truncate">
                    {o ? `${o.public_code}, ${fmtAgo(o.observed_at)}` : 'Sighting'}
                  </span>
                </span>
                {l.decision === 'unsure' ? <Badge tone="warn">Unsure</Badge> : null}
              </li>
            );
          })}
          {pending.length <= 1 ? (
            <li className="text-[13px] text-ink2">This is the last one.</li>
          ) : null}
        </ol>
        <p className="text-[12px] text-ink3 mt-4">
          Only confirmed resightings enter capture histories and SECR exports. Rejected links are
          kept, not deleted.
        </p>
      </Card>
    </div>
  );
}

function AnimalGrid({
  params,
  individuals,
  links,
}: {
  params: URLSearchParams;
  individuals?: Individual[];
  links?: Link[];
}) {
  const core = useCore();
  const q = params.get('q') ?? '';
  const sp = params.get('kind') ?? 'all';
  const sort = params.get('sort') ?? 'recent';
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    const r = (individuals ?? []).filter(
      (i) =>
        (sp === 'all' || i.species === sp) &&
        (!n ||
          animalName(i).toLowerCase().includes(n) ||
          (COAT_LABEL[i.coat_pattern ?? ''] ?? '').toLowerCase().includes(n))
    );
    return r.sort((a, b) =>
      sort === 'most'
        ? b.sightings_count - a.sightings_count
        : sort === 'name'
          ? animalName(a).localeCompare(animalName(b))
          : (b.last_seen ?? '').localeCompare(a.last_seen ?? '')
    );
  }, [individuals, q, sp, sort]);
  const observers = (id: string) => {
    const obs = new Set(
      (links ?? [])
        .filter((l) => l.individual_id === id && l.status === 'confirmed')
        .map((l) => l.observation_id)
    );
    return new Set(
      (core.sightings.data ?? []).filter((s) => obs.has(s.id)).map((s) => s.observer_id)
    ).size;
  };

  if (!individuals) return <Skeleton className="h-[420px]" />;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative w-full max-w-[340px]">
          <Search
            aria-hidden
            className="w-4 h-4 text-ink3 absolute start-4 top-1/2 -translate-y-1/2"
          />
          <label className="sr-only" htmlFor="a-q">
            Search animals
          </label>
          <input
            id="a-q"
            type="search"
            name="animal-search"
            autoComplete="off"
            defaultValue={q}
            onChange={(e) => setParam('q', e.target.value || undefined)}
            placeholder="Search by name or coat…"
            className={`${inputClass} w-full h-10 ps-11 rounded-full bg-surface border-0 shadow-pill`}
          />
        </div>
        <Segmented
          label="Species"
          value={sp}
          onChange={(v) => setParam('kind', v === 'all' ? undefined : v)}
          options={[
            { value: 'all', label: 'All' },
            { value: 'cat', label: 'Cats' },
            { value: 'dog', label: 'Dogs' },
          ]}
        />
        <Segmented
          label="Sort"
          value={sort}
          onChange={(v) => setParam('sort', v === 'recent' ? undefined : v)}
          options={[
            { value: 'recent', label: 'Last seen' },
            { value: 'most', label: 'Most seen' },
            { value: 'name', label: 'Name' },
          ]}
        />
        <span className="ms-auto text-[13px] text-ink2 tabular">{fmtInt(rows.length)} animals</span>
      </div>
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PawPrint />}
            title="No animals match"
            body="Volunteers register an animal in the app with New Animal to Follow."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {rows.map((i) => (
            <li key={i.id}>
              <a
                href={href(`animals/${i.id}`)}
                className="group block bg-surface rounded-card shadow-card p-3 hover:-translate-y-0.5 transition-transform duration-200"
              >
                <div className="relative">
                  <PhotoTile
                    photo={
                      i.photo_path
                        ? {
                            id: i.id,
                            observation_id: '',
                            storage_path: i.photo_path,
                            angle: 'left_flank',
                          }
                        : undefined
                    }
                    label={`Photo of ${animalName(i)}`}
                    className="h-[180px]"
                    caption={false}
                  />
                </div>
                <div className="px-2 pt-3 pb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[17px] font-semibold truncate flex-1">{animalName(i)}</h3>
                    {i.pending_links ? (
                      <Badge tone="warn">{fmtInt(i.pending_links)} to review</Badge>
                    ) : null}
                  </div>
                  <p className="text-[13px] text-ink2 truncate">
                    {SPECIES_LABEL[i.species]}
                    {i.coat_pattern ? `, ${COAT_LABEL[i.coat_pattern] ?? i.coat_pattern}` : ''}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <span
                      className={cx(
                        'inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[12px] font-semibold tabular'
                      )}
                    >
                      {fmtInt(i.sightings_count)} sightings
                    </span>
                    <span className="inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[12px] text-ink2">
                      Seen {fmtAgo(i.last_seen)}
                    </span>
                    <span className="inline-flex items-center h-8 px-3 rounded-full bg-canvas text-[12px] text-ink2 tabular">
                      {observers(i.id)} observers
                    </span>
                  </div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
