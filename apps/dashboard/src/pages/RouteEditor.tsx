import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Eraser,
  Flag,
  Magnet,
  Redo2,
  RefreshCcw,
  Route as RouteIcon,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  createRoute,
  updateRoute,
  type DirectionRule,
  type RouteRules,
  type SideRule,
} from '../data/api';
import { MAPBOX_TOKEN } from '../data/client';
import { useCore } from '../data/portal';
import { invalidate } from '../data/useData';
import { rotateLoop } from '../lib/compliance';
import { fmtDuration, fmtInt, fmtKm } from '../lib/format';
import { lineLengthKm, lineToEwkt } from '../lib/geo';
import { href, navigate } from '../lib/router';
import { useDark } from '../lib/theme';
import { MapView, type BaseStyle, type MapPoint } from '../components/LazyMap';
import {
  Button,
  Card,
  cx,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  inputClass,
  LinkButton,
  Notice,
  PageHeader,
  Segmented,
  Skeleton,
  Switch,
} from '../ui';
import type { PageProps } from './types';

type LL = [number, number];

/** Walking path between two points along streets (Mapbox Directions, walking profile). */
async function walkingPath(a: LL, b: LL): Promise<LL[] | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${a[0]},${a[1]};${b[0]},${b[1]}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as { routes?: { geometry: { coordinates: LL[] } }[] };
    return j.routes?.[0]?.geometry.coordinates ?? null;
  } catch {
    return null;
  }
}

const near = (a: LL, b: LL) => lineLengthKm([a, b]) < 0.04;

/**
 * Draw or edit a fixed route and its walking protocol.
 *
 * The line is ordered: the first point is the start and arrows show the
 * walking direction. Click the map to add points (optionally following the
 * streets), drag a point to move it, click a point to select it, then delete
 * it or, on a loop, make it the start. Reverse flips the direction. The rules
 * on the right are what every volunteer is asked to follow.
 */
export function RouteEditor({ id }: PageProps) {
  const core = useCore();
  const dark = useDark();
  const editing = id && id !== 'new' ? core.routes.data?.find((r) => r.id === id) : undefined;
  const loading = id !== 'new' && !core.routes.data;

  const [coords, setCoords] = useState<LL[]>([]);
  const [past, setPast] = useState<LL[][]>([]);
  const [future, setFuture] = useState<LL[][]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [snap, setSnap] = useState(false);
  const [routing, setRouting] = useState(false);
  const [base, setBase] = useState<BaseStyle>('streets');
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [rules, setRules] = useState<RouteRules>({
    direction_rule: 'as_drawn',
    side_rule: 'both',
    strip_width_m: 25,
    target_duration_min: null,
    window_start: null,
    window_end: null,
    revisit_days: 7,
    require_complete: true,
    instructions: '',
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!editing || loaded) return;
    setCoords(editing.geometry?.coordinates ?? []);
    setName(editing.name);
    setArea(editing.delegation ?? '');
    setNotes(editing.habitat_notes ?? '');
    setRules({
      direction_rule: editing.direction_rule ?? 'as_drawn',
      side_rule: editing.side_rule ?? 'both',
      strip_width_m: editing.strip_width_m ?? null,
      target_duration_min: editing.target_duration_min ?? null,
      window_start: editing.window_start?.slice(0, 5) ?? null,
      window_end: editing.window_end?.slice(0, 5) ?? null,
      revisit_days: editing.revisit_days ?? null,
      require_complete: editing.require_complete ?? true,
      instructions: editing.instructions ?? '',
    });
    setLoaded(true);
  }, [editing, loaded]);

  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', on);
    return () => window.removeEventListener('beforeunload', on);
  }, [dirty]);

  const commit = (next: LL[]) => {
    setPast((p) => [...p.slice(-80), coords]);
    setFuture([]);
    setCoords(next);
    setDirty(true);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [coords, ...f]);
    setCoords(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
    setSel(null);
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, coords]);
    setCoords(future[0]);
    setFuture((f) => f.slice(1));
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (/input|textarea|select/i.test((e.target as HTMLElement).tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && sel != null) {
        e.preventDefault();
        removePoint(sel);
      } else if (e.key === 'Escape') setSel(null);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  });

  const addPoint = async (p: LL) => {
    setSel(null);
    if (snap && coords.length) {
      setRouting(true);
      const path = await walkingPath(coords[coords.length - 1], p);
      setRouting(false);
      if (path && path.length > 1) {
        commit([...coords, ...path.slice(1)]);
        return;
      }
      setError('Could not follow the streets here, so a straight segment was added.');
    }
    commit([...coords, p]);
  };
  const movePoint = (i: number, p: LL) => {
    setCoords((c) => {
      const next = [...c];
      next[i] = p;
      // Keep a closed loop closed when its shared start/end point moves
      if (loop && (i === 0 || i === c.length - 1)) {
        next[0] = p;
        next[next.length - 1] = p;
      }
      return next;
    });
    setDirty(true);
  };
  const removePoint = (i: number) => {
    commit(coords.filter((_, k) => k !== i));
    setSel(null);
  };

  const loop = coords.length > 3 && near(coords[0], coords[coords.length - 1]);
  const km = lineLengthKm(coords);
  const minutes = km ? Math.round((km / 3) * 60) : 0;
  const visits = editing
    ? (core.walks.data ?? []).filter((w) => w.route_id === editing.id).length
    : 0;
  const nameTaken = useMemo(
    () =>
      (core.routes.data ?? []).some(
        (r) =>
          r.id !== editing?.id &&
          !r.deleted_at &&
          r.name.trim().toLowerCase() === name.trim().toLowerCase()
      ),
    [core.routes.data, name, editing?.id]
  );
  const windowError =
    (rules.window_start && !rules.window_end) || (!rules.window_start && rules.window_end)
      ? 'Set both times, or neither.'
      : null;
  const canSave =
    coords.length >= 2 && name.trim().length > 0 && !nameTaken && !windowError && !saving;

  const set = <K extends keyof RouteRules>(k: K, v: RouteRules[K]) => {
    setRules((r) => ({ ...r, [k]: v }));
    setDirty(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      setError(
        coords.length < 2
          ? 'Add at least two points on the map.'
          : !name.trim()
            ? 'Give the route a name.'
            : nameTaken
              ? 'Another live route has this name.'
              : windowError
      );
      return;
    }
    setSaving(true);
    setError(null);
    const draft = {
      ...rules,
      name: name.trim(),
      area: area.trim(),
      notes: notes.trim(),
      ewkt: lineToEwkt(coords),
      lengthKm: km,
    };
    try {
      if (editing) await updateRoute(editing.id, draft);
      else await createRoute(draft);
      invalidate('routes');
      await core.routes.reload();
      setDirty(false);
      navigate(editing ? `routes/${editing.id}` : 'routes');
    } catch (err) {
      setError(
        `The route was not saved: ${err instanceof Error ? err.message : String(err)}. Check the connection and try again.`
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-[640px]" />;
  if (id !== 'new' && !editing)
    return (
      <Card>
        <EmptyState
          icon={<RouteIcon />}
          title="Route not found"
          action={<LinkButton href={href('routes')}>Back to Routes</LinkButton>}
        />
      </Card>
    );

  const markers: MapPoint[] = [];
  const leave = () =>
    dirty ? setConfirmLeave(true) : navigate(editing ? `routes/${editing.id}` : 'routes');

  return (
    <>
      <PageHeader
        back={{
          href: editing ? href(`routes/${editing.id}`) : href('routes'),
          label: editing ? editing.name : 'Routes',
        }}
        title={editing ? `Edit ${editing.name}` : 'New route'}
        description="Click along the streets in walking order. The green point is the start; arrows show the direction everyone walks."
      />
      {editing && visits > 0 ? (
        <Notice tone="warn">
          {fmtInt(visits)} {visits === 1 ? 'walk was' : 'walks were'} recorded on this route.
          Changing the line or the rules starts protocol version {(editing.version ?? 1) + 1};
          earlier walks keep version {editing.version ?? 1}, so analyses can separate them. Renaming
          alone does not.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" onClose={() => setError(null)}>
          {error}
        </Notice>
      ) : null}

      <form onSubmit={save} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card className="p-2 relative">
          <MapView
            lines={
              coords.length >= 2
                ? [
                    {
                      id: 'draft',
                      coords,
                      kind: 'draft',
                      arrows: rules.direction_rule !== 'either',
                    },
                  ]
                : []
            }
            points={markers}
            vertices={coords}
            onMapClick={addPoint}
            onVertexMove={movePoint}
            onVertexClick={(i) => setSel((s) => (s === i ? null : i))}
            dark={dark}
            base={base}
            fit={!!editing}
            fitKey={editing ? `edit-${editing.id}-${loaded}` : undefined}
            height="max(520px, calc(100dvh - 330px))"
            label="Route drawing map: click to add a point, drag a point to move it, click a point to select it"
          />
          {/* Tool bar */}
          <div className="absolute top-5 start-5 flex flex-wrap gap-2 max-w-[calc(100%-90px)]">
            <div className="glass rounded-full shadow-float p-1.5 flex items-center gap-1">
              <IconButton label="Undo" onClick={undo} disabled={!past.length} size={36}>
                <Undo2 />
              </IconButton>
              <IconButton label="Redo" onClick={redo} disabled={!future.length} size={36}>
                <Redo2 />
              </IconButton>
              <span aria-hidden className="w-px h-6 bg-line mx-1" />
              <IconButton
                label="Reverse direction"
                onClick={() => commit([...coords].reverse())}
                disabled={coords.length < 2}
                size={36}
              >
                <ArrowLeftRight />
              </IconButton>
              <IconButton
                label={loop ? 'Open the loop' : 'Close the loop back to the start'}
                active={loop}
                onClick={() => commit(loop ? coords.slice(0, -1) : [...coords, coords[0]])}
                disabled={coords.length < 3}
                size={36}
              >
                <RefreshCcw />
              </IconButton>
              <IconButton
                label="Clear all points"
                onClick={() => commit([])}
                disabled={!coords.length}
                size={36}
              >
                <Eraser />
              </IconButton>
            </div>
            <label className="glass rounded-full shadow-float h-12 ps-4 pe-2 flex items-center gap-2 text-[13px] font-semibold">
              <Magnet aria-hidden className="w-4 h-4" />
              Follow streets
              <Switch label="Follow streets when adding points" checked={snap} onChange={setSnap} />
            </label>
          </div>
          <div className="absolute bottom-5 start-5 end-5 sm:end-auto flex flex-wrap items-center gap-2">
            <div
              className="glass rounded-full shadow-float h-12 px-5 flex items-center gap-4 text-[13px]"
              aria-live="polite"
            >
              <span>
                <span className="font-semibold tabular">{fmtInt(coords.length)}</span> points
              </span>
              <span>
                <span className="font-semibold tabular">{fmtKm(km)}</span> km
              </span>
              <span className="text-ink2">about {fmtDuration(minutes)} at 3 km/h</span>
              {routing ? <span className="text-ink2">Finding the street path…</span> : null}
            </div>
            <div className="glass rounded-full shadow-float p-1">
              <Segmented
                size="sm"
                label="Base map"
                value={base}
                onChange={setBase}
                options={[
                  { value: 'streets', label: 'Streets' },
                  { value: 'light', label: 'Light' },
                  { value: 'satellite', label: 'Satellite' },
                ]}
              />
            </div>
          </div>
          {sel != null && coords[sel] ? (
            <div
              className="absolute top-20 start-5 glass rounded-tile shadow-float p-3 w-[250px] rise"
              role="dialog"
              aria-label="Selected point"
            >
              <p className="text-[13px] font-semibold mb-2">
                {sel === 0
                  ? 'Start point'
                  : sel === coords.length - 1 && !loop
                    ? 'End point'
                    : `Point ${sel + 1} of ${coords.length}`}
              </p>
              <div className="flex flex-col gap-1.5">
                {loop && sel !== 0 && sel !== coords.length - 1 ? (
                  <Button
                    size="sm"
                    kind="dark"
                    icon={<Flag />}
                    onClick={() => (commit(rotateLoop(coords, sel)), setSel(0))}
                  >
                    Make This the Start
                  </Button>
                ) : null}
                {!loop && sel === coords.length - 1 ? (
                  <Button
                    size="sm"
                    kind="dark"
                    icon={<Flag />}
                    onClick={() => (commit([...coords].reverse()), setSel(0))}
                  >
                    Start Here Instead
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  kind="danger"
                  icon={<Trash2 />}
                  onClick={() => removePoint(sel)}
                  disabled={loop && (sel === 0 || sel === coords.length - 1)}
                >
                  Delete Point
                </Button>
              </div>
              <p className="text-[11px] text-ink3 mt-2">
                Drag to move. Delete or Backspace removes it.
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6 flex flex-col gap-5 self-start xl:sticky xl:top-[104px] xl:max-h-[calc(100dvh-128px)] xl:overflow-y-auto">
          <section className="flex flex-col gap-4">
            <h2 className="text-[17px] font-semibold">Route</h2>
            <Field
              label="Name"
              htmlFor="r-name"
              error={nameTaken ? 'Another live route has this name.' : null}
            >
              <input
                id="r-name"
                name="route-name"
                autoComplete="off"
                value={name}
                onChange={(e) => (setName(e.target.value), setDirty(true))}
                placeholder="Medina souks loop…"
                className={`${inputClass} w-full`}
                maxLength={120}
                required
              />
            </Field>
            <Field
              label="Area"
              htmlFor="r-area"
              hint="Neighbourhood or delegation, shown to volunteers."
            >
              <input
                id="r-area"
                name="route-area"
                autoComplete="off"
                value={area}
                onChange={(e) => (setArea(e.target.value), setDirty(true))}
                placeholder="Medina…"
                className={`${inputClass} w-full`}
              />
            </Field>
            <Field
              label="Habitat"
              htmlFor="r-notes"
              hint="What the route passes: markets, housing, parks."
            >
              <input
                id="r-notes"
                name="route-habitat"
                autoComplete="off"
                value={notes}
                onChange={(e) => (setNotes(e.target.value), setDirty(true))}
                placeholder="Covered souks, food stalls…"
                className={`${inputClass} w-full`}
              />
            </Field>
          </section>

          <section className="flex flex-col gap-4 pt-5 border-t border-line">
            <div>
              <h2 className="text-[17px] font-semibold">Walking protocol</h2>
              <p className="text-[13px] text-ink2 mt-1">
                The same rules for everyone make visits comparable.
              </p>
            </div>
            <div>
              <p className="text-[13px] font-semibold mb-1.5">Direction</p>
              <Segmented<DirectionRule>
                label="Direction"
                value={rules.direction_rule ?? 'as_drawn'}
                onChange={(v) => set('direction_rule', v)}
                options={[
                  { value: 'as_drawn', label: 'One way, as drawn' },
                  { value: 'either', label: 'Either way' },
                ]}
              />
              <p className="text-[12px] text-ink3 mt-1.5">
                {rules.direction_rule === 'either'
                  ? 'Volunteers may start at either end.'
                  : 'Start at the green point and follow the arrows.'}
              </p>
            </div>
            <div>
              <p className="text-[13px] font-semibold mb-1.5">Side to record</p>
              <Segmented<SideRule>
                label="Side to record"
                value={rules.side_rule ?? 'both'}
                onChange={(v) => set('side_rule', v)}
                options={[
                  { value: 'both', label: 'Both' },
                  { value: 'left', label: 'Left' },
                  { value: 'right', label: 'Right' },
                ]}
              />
              <p className="text-[12px] text-ink3 mt-1.5">
                Left and right are facing the walking direction.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Strip width" htmlFor="r-strip" hint="Metres from the path">
                <input
                  id="r-strip"
                  name="strip-width"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={500}
                  value={rules.strip_width_m ?? ''}
                  onChange={(e) =>
                    set('strip_width_m', e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="25"
                  className={`${inputClass} w-full`}
                />
              </Field>
              <Field
                label="Target duration"
                htmlFor="r-dur"
                hint={minutes ? `Line suggests ${minutes} min` : 'Minutes'}
              >
                <input
                  id="r-dur"
                  name="target-duration"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={600}
                  value={rules.target_duration_min ?? ''}
                  onChange={(e) =>
                    set('target_duration_min', e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder={minutes ? String(minutes) : '40'}
                  className={`${inputClass} w-full`}
                />
              </Field>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[13px] font-semibold">Time window</p>
                <label className="inline-flex items-center gap-2 text-[13px]">
                  Any time
                  <Switch
                    label="Any time of day"
                    checked={!rules.window_start && !rules.window_end}
                    onChange={(v) =>
                      v
                        ? (set('window_start', null), set('window_end', null))
                        : (set('window_start', '07:00'), set('window_end', '10:00'))
                    }
                  />
                </label>
              </div>
              {rules.window_start || rules.window_end ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-[12px] text-ink2 flex flex-col gap-1">
                    From
                    <input
                      type="time"
                      name="window-start"
                      value={rules.window_start ?? ''}
                      onChange={(e) => set('window_start', e.target.value || null)}
                      className={`${inputClass} w-full`}
                    />
                  </label>
                  <label className="text-[12px] text-ink2 flex flex-col gap-1">
                    To
                    <input
                      type="time"
                      name="window-end"
                      value={rules.window_end ?? ''}
                      onChange={(e) => set('window_end', e.target.value || null)}
                      className={`${inputClass} w-full`}
                    />
                  </label>
                </div>
              ) : null}
              {windowError ? (
                <p className="text-[12px] text-danger mt-1">{windowError}</p>
              ) : (
                <p className="text-[12px] text-ink3 mt-1.5">
                  Animal activity changes through the day; a fixed window keeps visits comparable.
                </p>
              )}
            </div>
            <Field
              label="Revisit interval"
              htmlFor="r-revisit"
              hint="Minimum days between counted visits, for independent repeat surveys."
            >
              <input
                id="r-revisit"
                name="revisit-days"
                type="number"
                inputMode="numeric"
                min={0}
                max={365}
                value={rules.revisit_days ?? ''}
                onChange={(e) =>
                  set('revisit_days', e.target.value ? Number(e.target.value) : null)
                }
                placeholder="7"
                className={`${inputClass} w-full`}
              />
            </Field>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-[13px] font-semibold">Complete checklist required</span>
                <span className="block text-[12px] text-ink3">
                  Every cat and dog seen must be recorded.
                </span>
              </span>
              <Switch
                label="Complete checklist required"
                checked={rules.require_complete ?? true}
                onChange={(v) => set('require_complete', v)}
              />
            </label>
            <Field
              label="Instructions for walkers"
              htmlFor="r-instr"
              hint="Where exactly to start, what to avoid, anything a newcomer needs."
            >
              <textarea
                id="r-instr"
                name="instructions"
                rows={4}
                maxLength={2000}
                value={rules.instructions ?? ''}
                onChange={(e) => set('instructions', e.target.value)}
                placeholder="Start at Bab Bhar facing the Medina…"
                className={`${inputClass} w-full h-auto py-2.5`}
              />
            </Field>
          </section>

          <div className="flex gap-2 pt-5 border-t border-line sticky bottom-0 bg-surface -mx-6 px-6 -mb-6 pb-6">
            <Button type="submit" kind="dark" disabled={saving} className="flex-1">
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Route'}
            </Button>
            <Button kind="ghost" onClick={leave}>
              Cancel
            </Button>
          </div>
          {!coords.length ? (
            <p className={cx('text-[12px] text-ink3 -mt-2')}>
              Tip: turn on Follow Streets, then click the start and each corner.
            </p>
          ) : null}
        </Card>
      </form>

      <Dialog
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Leave without saving?"
        actions={
          <>
            <Button kind="ghost" onClick={() => setConfirmLeave(false)}>
              Keep Editing
            </Button>
            <Button
              kind="danger"
              onClick={() => (
                setDirty(false),
                navigate(editing ? `routes/${editing.id}` : 'routes')
              )}
            >
              Discard Changes
            </Button>
          </>
        }
      >
        Your changes to the line and rules will be lost.
      </Dialog>
    </>
  );
}
