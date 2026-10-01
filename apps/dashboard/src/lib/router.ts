import { useEffect, useState } from 'react';

/**
 * Hash router: "#/walks?status=flagged". The page and its filters live in the
 * URL, so every view can be bookmarked, shared and reopened (web guidelines:
 * URL reflects state).
 */
export interface Route {
  page: string;
  params: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { page: path || 'overview', params: new URLSearchParams(query) };
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

export function href(page: string, params?: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
  const s = q.toString();
  return `#/${page}${s ? `?${s}` : ''}`;
}

/** Update one filter in the current page's URL without adding history noise. */
export function setParam(key: string, value: string | undefined) {
  const { page, params } = parse();
  if (value) params.set(key, value);
  else params.delete(key);
  const s = params.toString();
  history.replaceState(null, '', `#/${page}${s ? `?${s}` : ''}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
