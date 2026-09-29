/**
 * delete-account: right to erasure (GDPR Art. 17) with anonymise-not-destroy.
 *
 * 1. Authenticates the caller from their own JWT.
 * 2. Calls anonymize_user_contributions (service role only), which keeps the
 *    de-identified observations and effort totals and strips precise
 *    coordinates, GPS breadcrumbs, notes and photo rows.
 * 3. Removes the caller's photo files from the animal-photos bucket.
 * 4. Deletes the auth user, cascading to the profile and personal tables.
 *
 * The request body must be {"confirm": "DELETE"} so a stray call cannot erase an account.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PHOTO_BUCKET = 'animal-photos';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') {
      return jsonResponse({ error: 'Missing confirmation' }, 400);
    }

    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');

    const { data: anonymized, error: anonErr } = await admin.rpc('anonymize_user_contributions', {
      p_user_id: userId,
    });
    if (anonErr) {
      console.error('anonymize_user_contributions failed', anonErr);
      return jsonResponse({ error: 'Anonymisation failed' }, 500);
    }

    // Only bucket paths; rows that still point at a device URI have no file
    const photoPaths: string[] = (anonymized?.photo_paths || []).filter(
      (p: unknown): p is string => typeof p === 'string' && p.startsWith('observations/')
    );

    for (let i = 0; i < photoPaths.length; i += 100) {
      const { error: rmErr } = await admin.storage.from(PHOTO_BUCKET).remove(photoPaths.slice(i, i + 100));
      if (rmErr) {
        console.error('Photo removal failed', rmErr);
        return jsonResponse({ error: 'Photo removal failed' }, 500);
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('deleteUser failed', delErr);
      return jsonResponse({ error: 'Account deletion failed' }, 500);
    }

    return jsonResponse(
      {
        success: true,
        observations_anonymized: anonymized?.observations_anonymized ?? 0,
        sessions_anonymized: anonymized?.sessions_anonymized ?? 0,
        photos_removed: photoPaths.length,
      },
      200
    );
  } catch (err) {
    console.error('delete-account error', err);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
