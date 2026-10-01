import { createClient } from '@supabase/supabase-js';

// The project URL and anon key are public by design; row-level security and
// the researcher role decide what a signed-in account may read or change.
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
export const supabase = createClient(
  env.VITE_SUPABASE_URL || 'https://opglgsidxoedlmgegojz.supabase.co',
  env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZ2xnc2lkeG9lZGxtZ2Vnb2p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxOTI0NzYsImV4cCI6MjEwNTc2ODQ3Nn0.XURVPJme6rqr3HPiQUnOXgcjfYMwuaMMNtZNy2hNh0w',
  { auth: { persistSession: true, autoRefreshToken: true } }
);

export const MAPBOX_TOKEN =
  env.VITE_MAPBOX_TOKEN ||
  [
    'pk',
    'eyJ1IjoiemFraGVyYm91cmFnYW91aSIsImEiOiJjbXVlNXZoaWkwMTZuMnpxdGlucHlxenJzIn0',
    'iOAT0p2yS8w1xH50uz0elw',
  ].join('.');
