import { useMemo, useState } from 'react';
import { Plus, Route as RouteIcon, Undo2 } from 'lucide-react';
import { createRoute, getRoutes, setRouteActive } from '../data/api';
import { invalidate, useData } from '../data/useData';
import { fmtDate, fmtKm } from '../lib/format';
import { lineLengthKm, lineToEwkt } from '../lib/geo';
import { MapView, type MapLine } from '../components/LazyMap';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  Field,
  inputClass,
  PageHeader,
  Skeleton,
  Table,
  td,
  th,
  tdNum,
} from '../ui';
import type { PageProps } from './types';

export function Routes(_: PageProps) {
  const routes = useData('routes', getRoutes);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<[number, number][]>([]);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dark = document.documentElement.dataset.theme === 'dark';

  const lines = useMemo<MapLine[]>(() => {
    const out: MapLine[] = (routes.data ?? [])
      .filter((r) => r.geometry && r.is_active)
      .map((r) => ({ id: r.id, coords: r.geometry!.coordinates, kind: 'route' }));
    if (draft.length >= 2) out.push({ id: 'draft', coords: draft, kind: 'draft' });
    return out;
  }, [routes.data, draft]);
  const km = lineLengthKm(draft);

  const reset = () => {
    setDrawing(false);
    setDraft([]);
    setName('');
    setArea('');
    setNotes('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draft.length < 2 || !name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await createRoute({
        name: name.trim(),
        area: area.trim(),
        notes: notes.trim(),
        ewkt: lineToEwkt(draft),
        lengthKm: km,
      });
      invalidate('routes');
      await routes.reload();
      setMessage(`${name.trim()} is live. Volunteers get it the next time the app syncs.`);
      reset();
    } catch (err) {
      setMessage(`The route was not saved: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, active: boolean) => {
    try {
      await setRouteActive(id, active);
      invalidate('routes');
      await routes.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Routes"
        description="Fixed routes volunteers can walk again and again, so counts can be compared over time."
        actions={
          drawing ? null : (
            <Button icon={<Plus />} onClick={() => setDrawing(true)}>
              New Route
            </Button>
          )
        }
      />
      {message ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-control bg-lime-soft text-accent px-4 py-3 text-[14px]"
        >
          {message}
        </p>
      ) : null}
      {routes.error ? <ErrorNote message={routes.error} onRetry={routes.reload} /> : null}

      <div className={drawing ? 'grid gap-5 xl:grid-cols-[1fr_360px]' : ''}>
        <Card className="p-3">
          {drawing ? (
            <p className="px-2 pb-3 text-[14px] text-ink2">
              Click along the streets in walking order. Each click adds a point.
            </p>
          ) : null}
          <MapView
            lines={lines}
            dark={dark}
            height={drawing ? 560 : 380}
            fit={!drawing}
            onMapClick={drawing ? (p) => setDraft((d) => [...d, p]) : undefined}
            label={
              drawing ? 'Map for drawing a new route: click to add points' : 'Map of active routes'
            }
          />
        </Card>

        {drawing ? (
          <Card as="div">
            <CardHeader
              title="New route"
              description={
                draft.length
                  ? `${draft.length} ${draft.length === 1 ? 'point' : 'points'}, ${fmtKm(km)} km`
                  : 'No points yet'
              }
            />
            <form onSubmit={save} className="px-5 pb-5 flex flex-col gap-4">
              <div className="flex gap-2">
                <Button
                  kind="secondary"
                  size="sm"
                  icon={<Undo2 />}
                  disabled={!draft.length}
                  onClick={() => setDraft((d) => d.slice(0, -1))}
                >
                  Undo Point
                </Button>
                <Button
                  kind="ghost"
                  size="sm"
                  disabled={!draft.length}
                  onClick={() => setDraft([])}
                >
                  Clear
                </Button>
              </div>
              <Field label="Name" htmlFor="r-name">
                <input
                  id="r-name"
                  name="route-name"
                  autoComplete="off"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Harbour loop…"
                  className={`${inputClass} w-full`}
                  required
                  maxLength={120}
                />
              </Field>
              <Field
                label="Area"
                htmlFor="r-area"
                hint="Neighbourhood or district, shown to volunteers."
              >
                <input
                  id="r-area"
                  name="route-area"
                  autoComplete="off"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Old town…"
                  className={`${inputClass} w-full`}
                />
              </Field>
              <Field
                label="Notes for walkers"
                htmlFor="r-notes"
                hint="Habitat, where to start, anything to watch out for."
              >
                <textarea
                  id="r-notes"
                  name="route-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={`${inputClass} w-full h-auto py-2.5`}
                />
              </Field>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={saving || draft.length < 2 || !name.trim()}>
                  {saving ? 'Saving…' : 'Save Route'}
                </Button>
                <Button kind="ghost" onClick={reset}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        ) : null}
      </div>

      <Card className="mt-5">
        {!routes.data ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : routes.data.length === 0 ? (
          <EmptyState
            icon={<RouteIcon />}
            title="No routes yet"
            body="Draw the first one with New Route. Volunteers see it in the app's route picker after their next sync."
          />
        ) : (
          <Table label="Routes">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Area</th>
                <th className={`${th} text-right`}>Length</th>
                <th className={th}>Created</th>
                <th className={th}>Available to volunteers</th>
              </tr>
            </thead>
            <tbody>
              {routes.data.map((r) => (
                <tr key={r.id} className="hover:bg-canvas">
                  <td className={`${td} font-medium`}>{r.name}</td>
                  <td className={`${td} text-ink2`}>
                    {[r.delegation, r.governorate].filter(Boolean).join(', ') || '-'}
                  </td>
                  <td className={tdNum}>
                    {r.length_km != null ? `${fmtKm(r.length_km)} km` : '-'}
                  </td>
                  <td className={`${td} text-ink2 whitespace-nowrap`}>{fmtDate(r.created_at)}</td>
                  <td className={td}>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        role="switch"
                        checked={r.is_active}
                        onChange={(e) => toggle(r.id, e.target.checked)}
                        className="w-4 h-4 accent-[var(--accent)]"
                      />
                      <span className="text-[14px]">{r.is_active ? 'On' : 'Off'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
