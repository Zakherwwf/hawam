import { useEffect, useState } from 'react';

/**
 * Hash router: "#/walks/<id>?from=2026-09-01&sp=cat". The page, the record
 * being looked at and every filter live in the URL, so any view can be
 * bookmarked, shared and reopened (web guidelines: URL reflects state).
 */
export interface Route {
  page: string;
  /** Second path segment: the record a profile page shows, or "new" */
  id: string | null;
  /** Third path segment, e.g. "edit" in #/routes/<id>/edit */
  sub: string | null;
  params: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const [page, id, sub] = path.split('/').map((s) => decodeURIComponent(s));
  return {
    page: page || 'overview',
    id: id || null,
    sub: sub || null,
    params: new URLSearchParams(query),
  };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Link to a page or profile: href('walks'), href('walks/abc'), with params. */
export function href(path: string, params?: Record<string, string | undefined | null>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  return `#/${path}${s ? `?${s}` : ''}`;
}

/** Link that keeps the current global filters (date range, species…). */
export function hrefKeep(path: string, extra?: Record<string, string | undefined | null>) {
  const { params } = parse();
  const keep: Record<string, string | undefined | null> = {};
  for (const k of GLOBAL_KEYS) keep[k] = params.get(k);
  return href(path, { ...keep, ...extra });
}

export const GLOBAL_KEYS = ['range', 'from', 'to', 'sp', 'proto', 'status', 'who', 'route'];

export function navigate(path: string, params?: Record<string, string | undefined | null>) {
  window.location.hash = href(path, params);
}

function write(params: URLSearchParams) {
  const { page, id, sub } = parse();
  const path = [page, id, sub]
    .filter(Boolean)
    .map((s) => encodeURIComponent(s!))
    .join('/');
  const s = params.toString();
  history.replaceState(null, '', `#/${path}${s ? `?${s}` : ''}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Update one filter in the current URL without adding history noise. */
export function setParam(key: string, value: string | undefined | null) {
  setParams({ [key]: value });
}

export function setParams(values: Record<string, string | undefined | null>) {
  const { params } = parse();
  for (const [k, v] of Object.entries(values)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  write(params);
}
