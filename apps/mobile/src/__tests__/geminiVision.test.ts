import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseGeminiVisionResponse,
  generateOfflineHeuristicAnalysis,
  analyzeAnimalPhoto,
  type AnimalVisionAnalysis,
} from '../services/ai/geminiVision.ts';

test('Gemini Vision: parses valid raw JSON output into structured AnimalVisionAnalysis', () => {
  const mockRawResponse = JSON.stringify({
    species: 'cat',
    confidence: 0.94,
    breedOrType: 'North African Street Cat (Mau)',
    coatPattern: 'Brown tabby with white chest and paws',
    estimatedBodyConditionScore: 3,
    bcsRationale: 'Proportionate waist tuck, ribs not visibly protruding but palpable.',
    tnrStatus: 'left_ear_tipped',
    apparentWelfareAlert: false,
    welfareNotes: null,
  });

  const parsed = parseGeminiVisionResponse(mockRawResponse, 'gemini-3-flash');

  assert.equal(parsed.species, 'cat');
  assert.equal(parsed.confidence, 0.94);
  assert.equal(parsed.breedOrType, 'North African Street Cat (Mau)');
  assert.equal(parsed.coatPattern, 'Brown tabby with white chest and paws');
  assert.equal(parsed.estimatedBodyConditionScore, 3);
  assert.equal(parsed.tnrStatus, 'left_ear_tipped');
  assert.equal(parsed.apparentWelfareAlert, false);
  assert.equal(parsed.welfareNotes, null);
  assert.equal(parsed.source, 'gemini-3-flash');
});

test('Gemini Vision: strips markdown JSON fences (```json ... ```)', () => {
  const fencedResponse = `\`\`\`json
{
  "species": "dog",
  "confidence": 0.88,
  "breedOrType": "Baladi hound mix",
  "coatPattern": "Sandy yellow short coat",
  "estimatedBodyConditionScore": 2,
  "bcsRationale": "Visible rib cage and prominent hip bones, thin fat layer.",
  "tnrStatus": "untipped",
  "apparentWelfareAlert": true,
  "welfareNotes": "Superficial abrasion on left foreleg."
}
\`\`\``;

  const parsed = parseGeminiVisionResponse(fencedResponse);

  assert.equal(parsed.species, 'dog');
  assert.equal(parsed.confidence, 0.88);
  assert.equal(parsed.breedOrType, 'Baladi hound mix');
  assert.equal(parsed.estimatedBodyConditionScore, 2);
  assert.equal(parsed.tnrStatus, 'untipped');
  assert.equal(parsed.apparentWelfareAlert, true);
  assert.equal(parsed.welfareNotes, 'Superficial abrasion on left foreleg.');
});

test('Gemini Vision: sanitizes and clamps Body Condition Score between 1 and 5', () => {
  // Test case out-of-range (>5) -> defaults to 3
  const highBcs = JSON.stringify({
    species: 'cat',
    estimatedBodyConditionScore: 9,
    tnrStatus: 'untipped',
  });
  assert.equal(parseGeminiVisionResponse(highBcs).estimatedBodyConditionScore, 3);

  // Test case decimal rounding (2.2 -> 2)
  const floatBcs = JSON.stringify({
    species: 'dog',
    estimatedBodyConditionScore: 2.2,
    tnrStatus: 'untipped',
  });
  assert.equal(parseGeminiVisionResponse(floatBcs).estimatedBodyConditionScore, 2);

  // Test case 1 -> preserves 1 (emaciated)
  const emaciated = JSON.stringify({
    species: 'cat',
    estimatedBodyConditionScore: 1,
    tnrStatus: 'untipped',
  });
  assert.equal(parseGeminiVisionResponse(emaciated).estimatedBodyConditionScore, 1);
});

test('Gemini Vision: handles invalid enum values with safe defaults', () => {
  const invalidEnums = JSON.stringify({
    species: 'dinosaur',
    confidence: 'super_confident',
    tnrStatus: 'unknown_tag',
  });

  const parsed = parseGeminiVisionResponse(invalidEnums);
  assert.equal(parsed.species, 'unknown');
  assert.equal(parsed.tnrStatus, 'uncertain');
  assert.equal(parsed.confidence, 0.85); // Fallback confidence
});

test('Gemini Vision: falls back gracefully to offline heuristic on invalid JSON syntax', () => {
  const garbage = 'Internal Server Error 500: Database unreachable';
  const result = parseGeminiVisionResponse(garbage);

  assert.equal(result.source, 'offline-heuristic');
  assert.equal(result.species, 'cat');
  assert.equal(result.estimatedBodyConditionScore, 3);
});

test('Gemini Vision: offline heuristic provides sensible defaults for cat and dog', () => {
  const catAnalysis = generateOfflineHeuristicAnalysis({ speciesHint: 'cat' });
  assert.equal(catAnalysis.species, 'cat');
  assert.equal(catAnalysis.source, 'offline-heuristic');
  assert.match(catAnalysis.breedOrType, /Cat/i);

  const dogAnalysis = generateOfflineHeuristicAnalysis({ speciesHint: 'dog' });
  assert.equal(dogAnalysis.species, 'dog');
  assert.equal(dogAnalysis.source, 'offline-heuristic');
  assert.match(dogAnalysis.breedOrType, /Dog/i);
});

test('Gemini Vision: analyzeAnimalPhoto falls back to offline heuristic when API key is missing', async () => {
  const result = await analyzeAnimalPhoto('data:image/jpeg;base64,testdata', {
    apiKey: '',
    speciesHint: 'dog',
  });

  assert.equal(result.source, 'offline-heuristic');
  assert.equal(result.species, 'dog');
  assert.equal(result.estimatedBodyConditionScore, 3);
});

test('Gemini Vision: analyzeAnimalPhoto processes API response with mocked fetch', async () => {
  const originalFetch = globalThis.fetch;
  try {
    const mockApiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  species: 'cat',
                  confidence: 0.96,
                  breedOrType: 'North African Street Cat',
                  coatPattern: 'Calico tricolor',
                  estimatedBodyConditionScore: 3,
                  bcsRationale: 'Ideal weight, well groomed.',
                  tnrStatus: 'left_ear_tipped',
                  apparentWelfareAlert: false,
                  welfareNotes: null,
                }),
              },
            ],
          },
        },
      ],
    };

    globalThis.fetch = async () =>
      new Response(JSON.stringify(mockApiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const analysis = await analyzeAnimalPhoto('data:image/jpeg;base64,samplebase64==', {
      apiKey: 'test-fake-key',
      model: 'gemini-3-flash',
    });

    assert.equal(analysis.species, 'cat');
    assert.equal(analysis.confidence, 0.96);
    assert.equal(analysis.coatPattern, 'Calico tricolor');
    assert.equal(analysis.tnrStatus, 'left_ear_tipped');
    assert.equal(analysis.source, 'gemini-3-flash');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
