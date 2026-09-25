import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { photo_base64, species_hint } = await req.json();

    if (!photo_base64) {
      return new Response(
        JSON.stringify({ error: 'Missing photo_base64 parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const systemPrompt = `You are an expert veterinary epidemiologist and animal welfare scientist specializing in free-roaming dogs and cats in North Africa.
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\nSpecies hint: ${species_hint || 'none'}`,
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
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${errText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
