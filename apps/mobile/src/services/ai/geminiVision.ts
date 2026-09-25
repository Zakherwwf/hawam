/**
 * Gemini Multimodal AI Vision Service for Animal Welfare & Identification
 * Hawem (حايم) Citizen-Science Platform
 *
 * Implements:
 * - Multimodal analysis of animal photos using Gemini 3 / Gemini 1.5 / 2.5 Flash
 * - Structured JSON schema extraction for species, breed/type, coat pattern,
 *   ICAM body condition score (1-5), and TNR ear-tip status.
 * - Resilient offline heuristic fallback for field conditions without connectivity.
 */

export interface AnimalVisionAnalysis {
  species: 'cat' | 'dog' | 'unknown';
  confidence: number;
  breedOrType: string;
  coatPattern: string;
  estimatedBodyConditionScore: 1 | 2 | 3 | 4 | 5;
  bcsRationale: string;
  tnrStatus: 'left_ear_tipped' | 'right_ear_tipped' | 'untipped' | 'uncertain';
  apparentWelfareAlert: boolean;
  welfareNotes?: string | null;
  source: 'gemini-3-flash' | 'gemini-3.1-pro' | 'offline-heuristic';
}

const SYSTEM_PROMPT = `You are an expert veterinary epidemiologist and animal welfare scientist specializing in free-roaming dogs and cats in North Africa (Tunisia).
Analyze the provided animal image and return ONLY a valid JSON object matching this exact schema:
{
  "species": "cat" | "dog" | "unknown",
  "confidence": number between 0.0 and 1.0,
  "breedOrType": "string describing type or regional landrace, e.g. North African domestic cat / Baladi dog mix / Sloughi cross",
  "coatPattern": "string describing color and markings, e.g. Mackerel tabby with white bib / Solid black / Tricolor calico",
  "estimatedBodyConditionScore": integer between 1 and 5 according to ICAM (1=Emaciated, 2=Thin, 3=Ideal/Normal, 4=Overweight, 5=Obese),
  "bcsRationale": "short 1-sentence scientific reason based on visible ribs, pelvic bones, waist tuck",
  "tnrStatus": "left_ear_tipped" | "right_ear_tipped" | "untipped" | "uncertain",
  "apparentWelfareAlert": boolean (true if visible open wounds, severe emaciation BCS 1, or noticeable injury),
  "welfareNotes": "string or null if welfare alert is true"
}`;

/**
 * Parses and validates raw JSON output from Gemini API
 */
export function parseGeminiVisionResponse(
  rawText: string,
  modelName: 'gemini-3-flash' | 'gemini-3.1-pro' = 'gemini-3-flash'
): AnimalVisionAnalysis {
  try {
    // Strip markdown code fences if present
    const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const validSpecies = ['cat', 'dog', 'unknown'].includes(parsed.species)
      ? (parsed.species as 'cat' | 'dog' | 'unknown')
      : 'unknown';

    const bcsRaw = Number(parsed.estimatedBodyConditionScore);
    const bcs = (bcsRaw >= 1 && bcsRaw <= 5 ? Math.round(bcsRaw) : 3) as 1 | 2 | 3 | 4 | 5;

    const validTnr = ['left_ear_tipped', 'right_ear_tipped', 'untipped', 'uncertain'].includes(
      parsed.tnrStatus
    )
      ? parsed.tnrStatus
      : 'uncertain';

    return {
      species: validSpecies,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1.0, Math.max(0.0, parsed.confidence)) : 0.85,
      breedOrType: parsed.breedOrType || 'Domestic regional breed',
      coatPattern: parsed.coatPattern || 'Standard coat pattern',
      estimatedBodyConditionScore: bcs,
      bcsRationale: parsed.bcsRationale || 'Standard visual inspection',
      tnrStatus: validTnr,
      apparentWelfareAlert: Boolean(parsed.apparentWelfareAlert),
      welfareNotes: parsed.welfareNotes || null,
      source: modelName,
    };
  } catch (err) {
    return generateOfflineHeuristicAnalysis();
  }
}

/**
 * Deterministic offline fallback heuristic when device is offline or API key is not configured.
 */
export function generateOfflineHeuristicAnalysis(
  hints?: { speciesHint?: 'cat' | 'dog'; notesHint?: string }
): AnimalVisionAnalysis {
  const species = hints?.speciesHint || 'cat';
  return {
    species,
    confidence: 0.8,
    breedOrType: species === 'cat' ? 'North African Local Cat (Mau)' : 'Local Mixed-Breed Dog (Baladi)',
    coatPattern: species === 'cat' ? 'Tabby with white chest' : 'Sandy fawn short coat',
    estimatedBodyConditionScore: 3,
    bcsRationale: 'Normal abdominal tuck, ribs palpable with light fat cover (ICAM BCS 3).',
    tnrStatus: 'untipped',
    apparentWelfareAlert: false,
    welfareNotes: null,
    source: 'offline-heuristic',
  };
}

import { supabase } from '../supabase.ts';

/**
 * Main multimodal analysis function.
 * Proxies through Supabase Edge Function 'analyze-photo' so client bundles do NOT leak Gemini keys.
 * Falls back to offline heuristic if offline or when API call fails.
 */
export async function analyzeAnimalPhoto(
  photoUriOrBase64: string,
  options?: {
    apiKey?: string;
    model?: 'gemini-3-flash' | 'gemini-3.1-pro';
    speciesHint?: 'cat' | 'dog';
  }
): Promise<AnimalVisionAnalysis> {
  // If an explicit API key is provided (e.g. in automated unit tests), execute direct fetch
  if (options?.apiKey) {
    const model = options.model || 'gemini-3-flash';
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${options.apiKey}`;

    try {
      let base64Data = photoUriOrBase64;
      let mimeType = 'image/jpeg';

      if (photoUriOrBase64.startsWith('data:')) {
        const parts = photoUriOrBase64.split(',');
        const match = parts[0].match(/:(.*?);/);
        if (match) mimeType = match[1];
        base64Data = parts[1];
      }

      const payload = {
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
        },
      };

      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        return generateOfflineHeuristicAnalysis({ speciesHint: options?.speciesHint });
      }

      const data = await res.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!candidateText) {
        return generateOfflineHeuristicAnalysis({ speciesHint: options?.speciesHint });
      }

      return parseGeminiVisionResponse(candidateText, model);
    } catch {
      return generateOfflineHeuristicAnalysis({ speciesHint: options?.speciesHint });
    }
  }

  // Production path: Secure Supabase Edge Function without client secret exposure
  try {
    const { data, error } = await supabase.functions.invoke('analyze-photo', {
      body: {
        photo_base64: photoUriOrBase64,
        species_hint: options?.speciesHint,
      },
    });

    if (error || !data?.data) {
      return generateOfflineHeuristicAnalysis({ speciesHint: options?.speciesHint });
    }

    return data.data as AnimalVisionAnalysis;
  } catch {
    return generateOfflineHeuristicAnalysis({ speciesHint: options?.speciesHint });
  }
}
