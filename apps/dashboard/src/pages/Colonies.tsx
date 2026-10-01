import { Warehouse } from 'lucide-react';
import { getColonies } from '../data/api';
import { useData } from '../data/useData';
import { fmtDate, fmtInt } from '../lib/format';
import {
  Badge,
  Card,
  EmptyState,
  ErrorNote,
  PageHeader,
  Skeleton,
  Table,
  td,
  th,
  tdNum,
} from '../ui';
import type { PageProps } from './types';

export function Colonies(_: PageProps) {
  const colonies = useData('colonies', getColonies);
  const data = colonies.data ?? [];
  const known = data.filter((c) => c.estimated_population != null && c.sterilised_count != null);
  const pop = known.reduce((a, c) => a + (c.estimated_population ?? 0), 0);
  const ster = known.reduce((a, c) => a + (c.sterilised_count ?? 0), 0);
  return (
    <>
      <PageHeader
        title="Colonies"
        description={
          colonies.data && known.length
            ? `${fmtInt(data.length)} colonies and packs. Where counts were given, about ${Math.round((ster / Math.max(1, pop)) * 100)} percent of animals are sterilised.`
            : 'Places where groups of animals live or are fed, registered by volunteers.'
        }
      />
      {colonies.error ? <ErrorNote message={colonies.error} onRetry={colonies.reload} /> : null}
      <Card>
        {!colonies.data ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Warehouse />}
            title="No colonies yet"
            body="Volunteers register colonies from the Map tab in the app. They appear here once uploaded."
          />
        ) : (
          <Table label="Colonies">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Kind</th>
                <th className={th}>Area</th>
                <th className={`${th} text-right`}>Animals (est.)</th>
                <th className={`${th} text-right`}>Sterilised</th>
                <th className={th}>Facilities</th>
                <th className={`${th} text-right`}>Visits</th>
                <th className={th}>Last visit</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id} className="hover:bg-canvas">
                  <td className={`${td} font-medium max-w-[220px] truncate`}>
                    {c.name || 'Unnamed'}
                  </td>
                  <td className={td}>
                    <Badge
                      tone={c.species === 'dog' ? 'dog' : c.species === 'cat' ? 'cat' : 'neutral'}
                    >
                      {c.species}
                    </Badge>
                  </td>
                  <td className={`${td} text-ink2`}>{c.area || '-'}</td>
                  <td className={tdNum}>{c.estimated_population ?? '-'}</td>
                  <td className={tdNum}>
                    {c.sterilised_count != null && c.estimated_population
                      ? `${c.sterilised_count} (${Math.round((c.sterilised_count / c.estimated_population) * 100)}%)`
                      : '-'}
                  </td>
                  <td className={`${td} text-ink2`}>
                    {[c.has_water && 'Water', c.has_shelter && 'Shelter']
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </td>
                  <td className={tdNum}>{c.visit_count}</td>
                  <td className={`${td} whitespace-nowrap text-ink2`}>
                    {c.last_visit_at ? fmtDate(c.last_visit_at) : '-'}
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
