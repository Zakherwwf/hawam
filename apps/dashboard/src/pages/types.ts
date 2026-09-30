import type { Me } from '../data/api';
export interface PageProps {
  me: Me;
  params: URLSearchParams;
}
