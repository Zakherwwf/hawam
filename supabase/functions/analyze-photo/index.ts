import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const AnimalAnalysisSchema = z.object({
  species: z.enum(['cat', 'dog', 'unknown']),
  confidence: z.number().min(0).max(1),
  breedOrType: z.string().default('Domestic regional breed'),
  coatPattern: z.string().default('Standard coat pattern'),
  estimatedBodyConditionScore: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  bcsRationale: z.string().default('Visual assessment of ribs, spine, and waist tuck'),
  tnrStatus: z.enum(['left_ear_tipped', 'right_ear_tipped', 'untipped', 'uncertain']).default('uncertain'),
  apparentWelfareAlert: z.boolean().default(false),
  welfareNotes: z.string().nullable().optional(),
  source: z.literal('gemini-edge').default('gemini-edge'),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_AI_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT_PER_USER') || '50');
// ~6 MB of JPEG once decoded; the app sends 1600 px re-encoded photos
const MAX_PHOTO_BASE64_CHARS = 8 * 1024 * 1024;

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

  try {
    // Authenticate the caller with their own JWT. Anonymous requests are refused
    // so the metered Gemini key is never reachable with only the public anon key.
    const authHeader = req.headers.get('Authorization') || '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_ANON_KEY') || '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const { photo_base64, species_hint } = await req.json();

    if (!photo_base64 || typeof photo_base64 !== 'string') {
      return jsonResponse({ error: 'Missing photo_base64 parameter' }, 400);
    }
    if (photo_base64.length > MAX_PHOTO_BASE64_CHARS) {
      return jsonResponse({ error: 'Photo too large' }, 413);
    }

    // Per-user daily quota, counted atomically in Postgres
    const { data: withinQuota, error: quotaErr } = await userClient.rpc('consume_ai_quota', {
      p_daily_limit: DAILY_AI_LIMIT,
    });
    if (quotaErr) {
      return jsonResponse({ error: 'Quota check failed' }, 500);
    }
    if (withinQuota !== true) {
      return jsonResponse({ error: 'Daily AI analysis limit reached' }, 429);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY environment variable not configured on edge server',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are an expert veterinary epidemiologist and animal welfare scientist specializing in free-roaming dogs and cats worldwide.
Analyze the provided animal photo and return ONLY a valid JSON object matching this schema:
{
  "species": "cat" | "dog" | "unknown",
  "confidence": number between 0.0 and 1.0,
  "breedOrType": "string describing type or regional landrace",
  "coatPattern": "string describing color and markings",
  "estimatedBodyConditionScore": integer between 1 and 5 according to ICAM (1=Emaciated, 2=Thin, 3=Ideal/Normal, 4=Overweight, 5=Obese),
  "bcsRationale": "short 1-sentence scientific reason based on visible ribs, pelvic bones, waist tuck",
  "tnrStatus": "left_ear_tipped" | "right_ear_tipped" | "untipped" | "uncertain",
  "apparentWelfareAlert": boolean,
  "welfareNotes": "string or null"
}`;

    let cleanBase64 = photo_base64;
    let mimeType = 'image/jpeg';
    if (photo_base64.startsWith('data:')) {
      const parts = photo_base64.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      cleanBase64 = parts[1];
    }

    // Only known values reach the prompt
    const speciesHint = species_hint === 'cat' || species_hint === 'dog' ? species_hint : 'none';

    // Key in a header, not the query string, so it never lands in URL logs
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\nSpecies hint: ${speciesHint}`,
                },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: cleanBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini API error', response.status, await response.text());
      return jsonResponse({ error: 'Upstream analysis failed' }, 502);
    }

    const result = await response.json();
    const candidateText =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const rawParsed = JSON.parse(candidateText);
    const validated = AnimalAnalysisSchema.parse({
      ...rawParsed,
      source: 'gemini-edge',
    });

    return new Response(JSON.stringify({ success: true, data: validated }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
