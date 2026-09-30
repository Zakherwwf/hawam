import { useState } from 'react';
import { Download, FileSpreadsheet, Lock } from 'lucide-react';
import { getDwc, getSightings, getWalks, logExport } from '../data/api';
import { useData } from '../data/useData';
import { download, toCsv } from '../lib/csv';
import { distanceRows, effortRows, preciseRows } from '../lib/exports';
import { fmtInt } from '../lib/format';
import { Badge, Button, Card, ErrorNote, PageHeader } from '../ui';
import type { PageProps } from './types';

const stamp = () => new Date().toISOString().slice(0, 10);

export function Exports(_: PageProps) {
  const walks = useData('walks', getWalks);
  const sightings = useData('sightings', getSightings);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const ready = !!walks.data && !!sightings.data;
  const dist = ready ? distanceRows(walks.data!, sightings.data!) : null;

  const run = async (
    id: string,
    build: () => Promise<{ name: string; rows: Record<string, unknown>[]; precise: boolean }>
  ) => {
    setBusy(id);
    setStatus(null);
    try {
      const { name, rows, precise } = await build();
      download(`${name}_${stamp()}.csv`, toCsv(rows));
      await logExport(id, rows.length, precise, {});
      setStatus(`Downloaded ${fmtInt(rows.length)} rows. The export is recorded in the audit log.`);
    } catch (e) {
      setStatus(`The export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const items = [
    {
      id: 'darwin_core',
      title: 'Darwin Core occurrences',
      body: 'Standard biodiversity records for GBIF and most analysis tools. Locations are the centre of each 1 km grid cell, with the generalisation stated in every row. Flagged walks are excluded.',
      meta: 'Public-safe',
      tone: 'accent' as const,
      count: null as number | null,
      action: () =>
        run('darwin_core', async () => ({
          name: 'hawem_darwin_core',
          rows: await getDwc(),
          precise: false,
        })),
    },
    {
      id: 'survey_effort',
      title: 'Survey effort',
      body: 'One row per session with protocol, time, distance, completeness, weather, team size and detection counts, including complete walks with zero animals. For occupancy and N-mixture models.',
      meta: 'No locations',
      tone: 'accent' as const,
      count: walks.data?.length ?? null,
      action: () =>
        run('survey_effort', async () => ({
          name: 'hawem_survey_effort',
          rows: effortRows(walks.data!, sightings.data!),
          precise: false,
        })),
    },
    {
      id: 'distance_sampling',
      title: 'Distance sampling',
      body: `Flat table for the R Distance package: complete, unflagged transects with each detection's perpendicular distance. Transects without detections keep their effort.${dist && dist.skipped ? ` ${fmtInt(dist.skipped)} detections without a distance estimate are left out rather than guessed.` : ''}`,
      meta: 'No locations',
      tone: 'accent' as const,
      count: dist?.rows.length ?? null,
      action: () =>
        run('distance_sampling', async () => ({
          name: 'hawem_distance_sampling',
          rows: dist!.rows,
          precise: false,
        })),
    },
    {
      id: 'precise_sightings',
      title: 'Exact sighting positions',
      body: 'Every sighting with its exact latitude and longitude, for spatial models. Handle with care: exact positions of animals can put them at risk. This download is logged as containing precise coordinates.',
      meta: 'Exact coordinates',
      tone: 'warn' as const,
      count: sightings.data?.length ?? null,
      action: () =>
        run('precise_sightings', async () => ({
          name: 'hawem_sightings_exact',
          rows: preciseRows(sightings.data!),
          precise: true,
        })),
    },
  ];

  return (
    <>
      <PageHeader
        title="Exports"
        description="Analysis-ready files built from the live database. Every download is recorded with who made it and how many rows it held."
      />
      {walks.error || sightings.error ? (
        <ErrorNote message={(walks.error || sightings.error)!} />
      ) : null}
      {status ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-control bg-lime-soft text-accent px-4 py-3 text-[14px]"
        >
          {status}
        </p>
      ) : null}
      <div className="grid gap-5 md:grid-cols-2">
        {items.map((it) => (
          <Card key={it.id} className="p-5 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="w-10 h-10 rounded-control bg-lime-soft text-accent grid place-items-center shrink-0"
              >
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-semibold">{it.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge tone={it.tone}>{it.meta}</Badge>
                  {it.count != null ? (
                    <span className="text-[13px] text-ink2 tabular">{fmtInt(it.count)} rows</span>
                  ) : null}
                </div>
              </div>
            </div>
            <p className="text-[14px] text-ink2 flex-1">{it.body}</p>
            <div>
              <Button
                kind={it.tone === 'warn' ? 'secondary' : 'primary'}
                size="sm"
                icon={<Download />}
                disabled={!ready || busy !== null}
                onClick={it.action}
              >
                {busy === it.id ? 'Preparing…' : 'Download CSV'}
              </Button>
            </div>
          </Card>
        ))}
        <Card className="p-5 flex flex-col gap-3 md:col-span-2 bg-canvas shadow-none ring-1 ring-line">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-ink3" aria-hidden />
            <h2 className="text-[17px] font-semibold">Capture histories</h2>
            <Badge>Not available yet</Badge>
          </div>
          <p className="text-[14px] text-ink2">
            Capture-recapture and SECR need confirmed individual animals. They become available once
            re-identification is in place: volunteers link sightings of the same animal, and
            researchers confirm the matches here.
          </p>
        </Card>
      </div>
    </>
  );
}
