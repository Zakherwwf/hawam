// Design preview only (VITE_PREVIEW=1 in development). A literal false in
// production builds, so the sample data module is never bundled.
export const PREVIEW = import.meta.env.DEV && import.meta.env.VITE_PREVIEW === '1';
export const loadPreview = () => import('./preview');
