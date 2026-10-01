import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { getUsers, getUserStats, setRole, type Role } from '../data/api';
import { invalidate, useData } from '../data/useData';
import { fmtDate, fmtInt, fmtKm } from '../lib/format';
import { setParam } from '../lib/router';
import {
  Card,
  EmptyState,
  ErrorNote,
  inputClass,
  PageHeader,
  Segmented,
  Skeleton,
  Table,
  td,
  th,
  tdNum,
} from '../ui';
import type { PageProps } from './types';

const ROLES: { value: Role; label: string }[] = [
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'trained_surveyor', label: 'Trained surveyor' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'admin', label: 'Administrator' },
];

type Sort = 'km' | 'checklists' | 'recent';

export function Volunteers({ me, params }: PageProps) {
  const sort = (params.get('sort') as Sort) || 'km';
  const users = useData('users', getUsers);
  const stats = useData('userstats', getUserStats);
  const [note, setNote] = useState<string | null>(null);
  const admin = me.role === 'admin';

  const rows = useMemo(() => {
    const byId = new Map((stats.data ?? []).map((s) => [s.user_id, s]));
    const list = (users.data ?? []).map((u) => ({ ...u, s: byId.get(u.id) }));
    return list.sort((a, b) =>
      sort === 'recent'
        ? (b.s?.last_observed_at ?? '').localeCompare(a.s?.last_observed_at ?? '')
        : sort === 'checklists'
          ? (b.s?.complete_checklist_count ?? 0) - (a.s?.complete_checklist_count ?? 0)
          : (b.s?.distance_km ?? 0) - (a.s?.distance_km ?? 0)
    );
  }, [users.data, stats.data, sort]);

  const changeRole = async (id: string, name: string, role: Role) => {
    if (!window.confirm(`Change ${name}'s role to ${ROLES.find((r) => r.value === role)?.label}?`))
      return;
    try {
      await setRole(id, role);
      invalidate('users');
      await users.reload();
      setNote(`${name} is now ${ROLES.find((r) => r.value === role)?.label.toLowerCase()}.`);
    } catch (e) {
      setNote(`The role was not changed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <>
      <PageHeader
        title="Volunteers"
        description={
          admin
            ? 'Effort per person. As an administrator you can change roles here.'
            : 'Effort per person, never ranked by animals counted.'
        }
        actions={
          <Segmented
            label="Sort by"
            value={sort}
            onChange={(v) => setParam('sort', v === 'km' ? undefined : v)}
            options={[
              { value: 'km', label: 'Kilometres' },
              { value: 'checklists', label: 'Checklists' },
              { value: 'recent', label: 'Most recent' },
            ]}
          />
        }
      />
      {note ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-control bg-lime-soft text-accent px-4 py-3 text-[14px]"
        >
          {note}
        </p>
      ) : null}
      {users.error || stats.error ? <ErrorNote message={(users.error || stats.error)!} /> : null}
      <Card>
        {!users.data ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users />} title="No volunteers yet" />
        ) : (
          <Table label="Volunteers">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Role</th>
                <th className={`${th} text-right`}>km</th>
                <th className={`${th} text-right`}>Complete checklists</th>
                <th className={`${th} text-right`}>Zero-count</th>
                <th className={`${th} text-right`}>Sightings</th>
                <th className={`${th} text-right`}>XP</th>
                <th className={th}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 500).map((u) => {
                const name = u.display_name || 'Unnamed volunteer';
                return (
                  <tr key={u.id} className="hover:bg-canvas">
                    <td className={`${td} font-medium max-w-[220px] truncate`}>{name}</td>
                    <td className={td}>
                      {admin && u.id !== me.id ? (
                        <>
                          <label className="sr-only" htmlFor={`role-${u.id}`}>
                            Role for {name}
                          </label>
                          <select
                            id={`role-${u.id}`}
                            value={u.role}
                            onChange={(e) => changeRole(u.id, name, e.target.value as Role)}
                            className={`${inputClass} h-9 w-auto py-0 bg-surface text-[14px]`}
                          >
                            {ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <span className="text-ink2">
                          {ROLES.find((r) => r.value === u.role)?.label}
                        </span>
                      )}
                    </td>
                    <td className={tdNum}>{fmtKm(u.s?.distance_km ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(u.s?.complete_checklist_count ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(u.s?.zero_checklist_count ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(u.s?.observation_count ?? 0)}</td>
                    <td className={tdNum}>{fmtInt(u.s?.xp ?? 0)}</td>
                    <td className={`${td} text-ink2 whitespace-nowrap`}>{fmtDate(u.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
