import type { Me } from '../data/api';
export interface PageProps {
  me: Me;
  params: URLSearchParams;
  /** Record id from the URL (#/walks/<id>), or "new" */
  id?: string | null;
  /** Sub-view (#/routes/<id>/edit) */
  sub?: string | null;
}
