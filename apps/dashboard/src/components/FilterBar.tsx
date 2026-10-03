import { useState } from 'react';
import { Calendar, Check, ChevronDown, X } from 'lucide-react';
import { personName } from '../data/api';
import { useCore } from '../data/portal';
import {
  activeCount,
  isoDay,
  RANGE_LABEL,
  type Filters,
  type RangePreset,
  type SpeciesFilter,
} from '../lib/filters';
import { fmtDate } from '../lib/format';
import { setParams } from '../lib/router';
import { cx, Popover, selectChevron, selectPill } from '../ui';

const PRESETS: RangePreset[] = ['7d', '30d', '90d', '6m', '12m', 'all'];

/**
 * The one filter row (dataviz: filters sit above everything they scope,
 * date range first, presets before a custom range). Writes to the URL;
 * every chart, tile and table on the page re-reads the same slice.
 */
export function FilterBar({
  f,
  show = ['species', 'protocol', 'status', 'who', 'route'],
  summary,
  dates = true,
}: {
  f: Filters;
  dates?: boolean;
  show?: ('species' | 'protocol' | 'status' | 'who' | 'route')[];
  summary?: React.ReactNode;
}) {
  const { users, routes } = useCore();
  const n = activeCount(f);
  const has = (k: (typeof show)[number]) => show.includes(k);
  const toggleSpecies = (s: SpeciesFilter) => {
    const next = f.species.includes(s) ? f.species.filter((x) => x !== s) : [...f.species, s];
    setParams({ sp: next.join(',') || null });
  };
  return (
    <div role="search" aria-label="Filters" className="flex flex-wrap items-center gap-2 mb-5">
      {dates ? <DateRange f={f} /> : null}
      {has('species') ? (
        <div
          className="inline-flex items-center gap-1 h-10 p-1 rounded-full bg-surface shadow-pill"
          role="group"
          aria-label="Species"
        >
          {(['cat', 'dog', 'unknown'] as SpeciesFilter[]).map((s) => {
            const on = f.species.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSpecies(s)}
                className={cx(
                  'h-8 px-3 rounded-full text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors',
                  on ? 'bg-pill text-on-pill' : 'text-ink2 hover:text-ink'
                )}
              >
                <span
                  aria-hidden
                  className="w-2 h-2 rounded-full"
                  style={{
                    background:
                      s === 'cat'
                        ? 'var(--chart-cat)'
                        : s === 'dog'
                          ? 'var(--chart-dog)'
                          : 'var(--chart-unknown)',
                  }}
                />
                {s === 'cat' ? 'Cats' : s === 'dog' ? 'Dogs' : 'Unknown'}
              </button>
            );
          })}
        </div>
      ) : null}
      {has('protocol') ? (
        <PillSelect
          label="Record type"
          value={f.protocol ?? ''}
          onChange={(v) => setParams({ proto: v || null })}
          options={[
            ['', 'All record types'],
            ['transect', 'Survey walks'],
            ['stationary_point', 'Point counts'],
            ['incidental', 'Quick sightings'],
          ]}
        />
      ) : null}
      {has('status') ? (
        <PillSelect
          label="Status"
          value={f.status ?? ''}
          onChange={(v) => setParams({ status: v || null })}
          options={[
            ['', 'Any status'],
            ['valid', 'Not flagged'],
            ['complete', 'Complete checklists'],
            ['partial', 'Partial checklists'],
            ['flagged', 'Flagged'],
          ]}
        />
      ) : null}
      {has('who') ? (
        <PillSelect
          label="Volunteer"
          value={f.who ?? ''}
          onChange={(v) => setParams({ who: v || null })}
          options={[
            ['', 'Everyone'],
            ...[...(users.data ?? [])]
              .sort((a, b) => personName(a).localeCompare(personName(b)))
              .map((u) => [u.id, personName(u)] as [string, string]),
          ]}
        />
      ) : null}
      {has('route') ? (
        <PillSelect
          label="Route"
          value={f.route ?? ''}
          onChange={(v) => setParams({ route: v || null })}
          options={[
            ['', 'All routes and free walks'],
            ...(routes.data ?? []).map(
              (r) => [r.id, r.deleted_at ? `${r.name} (archived)` : r.name] as [string, string]
            ),
          ]}
        />
      ) : null}
      {n || (dates && f.range === 'custom') ? (
        <button
          type="button"
          onClick={() =>
            setParams({
              sp: null,
              proto: null,
              status: null,
              who: null,
              route: null,
              from: null,
              to: null,
            })
          }
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-semibold text-ink2 hover:text-ink hover:bg-surface"
        >
          <X aria-hidden className="w-4 h-4" />
          Clear{n ? ` ${n} ${n === 1 ? 'Filter' : 'Filters'}` : ''}
        </button>
      ) : null}
      {summary ? (
        <span className="ms-auto text-[13px] text-ink2 tabular" aria-live="polite">
          {summary}
        </span>
      ) : null}
    </div>
  );
}

function PillSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(selectPill, 'max-w-[220px] truncate', value && 'ring-2 ring-pill')}
        style={selectChevron}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function DateRange({ f }: { f: Filters }) {
  const [from, setFrom] = useState(f.from ? isoDay(f.from) : '');
  const [to, setTo] = useState(
    f.to ? isoDay(new Date(f.to.getTime() - 86400000)) : isoDay(new Date())
  );
  const text =
    f.range === 'custom'
      ? `${f.from ? fmtDate(f.from.toISOString()) : 'Start'} to ${f.to ? fmtDate(new Date(f.to.getTime() - 86400000).toISOString()) : 'today'}`
      : RANGE_LABEL[f.range];
  return (
    <Popover
      label="Date range"
      width={260}
      trigger={({ open, toggle, id }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={id}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-surface shadow-pill text-[14px] font-semibold"
        >
          <Calendar aria-hidden className="w-4 h-4 text-ink2" />
          {text}
          <ChevronDown aria-hidden className="w-4 h-4 text-ink2" />
        </button>
      )}
    >
      {(close) => (
        <div>
          <ul className="flex flex-col" role="listbox" aria-label="Preset ranges">
            {PRESETS.map((p) => {
              const on = f.range === p;
              return (
                <li key={p}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => {
                      setParams({ range: p === '90d' ? null : p, from: null, to: null });
                      close();
                    }}
                    className={cx(
                      'w-full flex items-center gap-2 h-10 px-3 rounded-[10px] text-[14px] hover:bg-canvas',
                      on && 'font-semibold'
                    )}
                  >
                    <span className="flex-1 text-start">{RANGE_LABEL[p]}</span>
                    {on ? <Check aria-hidden className="w-4 h-4" strokeWidth={3} /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="border-t border-line mt-2 pt-3 px-1 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setParams({ from: from || null, to: to || null, range: null });
              close();
            }}
          >
            <p className="text-[12px] font-semibold text-ink3 px-2">Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[12px] text-ink2 flex flex-col gap-1">
                From
                <input
                  type="date"
                  name="from"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-9 rounded-[10px] bg-canvas px-2 text-[13px] text-ink border border-line"
                />
              </label>
              <label className="text-[12px] text-ink2 flex flex-col gap-1">
                To
                <input
                  type="date"
                  name="to"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-9 rounded-[10px] bg-canvas px-2 text-[13px] text-ink border border-line"
                />
              </label>
            </div>
            <button
              type="submit"
              className="h-9 rounded-full bg-pill text-on-pill text-[13px] font-semibold mt-1"
            >
              Apply Range
            </button>
          </form>
        </div>
      )}
    </Popover>
  );
}
