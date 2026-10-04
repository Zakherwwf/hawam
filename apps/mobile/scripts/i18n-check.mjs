#!/usr/bin/env node
/**
 * Translation key gate (run in CI via `pnpm --filter @tunisia-survey/mobile i18n:check`).
 *
 * Fails when:
 *  - source calls t('key') / i18n.t('key') for a key missing from en.json
 *  - an enabled language (src/i18n/languages.json) lacks a key that en.json has,
 *    or its {{placeholders}} differ from English
 * Reports (without failing): coverage of draft languages, unused English keys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = path.join(root, 'src/i18n/locales');
const languages = JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/languages.json'), 'utf8'));
const PLURAL = /_(zero|one|two|few|many|other)$/;

const badKeyNames = [];
const leaves = (obj, prefix = '', out = new Map()) => {
  for (const [k, v] of Object.entries(obj)) {
    // i18next splits on '.', so a dot inside one JSON key can never be looked up
    if (k.includes('.')) badKeyNames.push(`${prefix}${k}`);
    if (v && typeof v === 'object' && !Array.isArray(v)) leaves(v, `${prefix}${k}.`, out);
    else out.set(`${prefix}${k}`, v);
  }
  return out;
};
const load = (lng) =>
  leaves(JSON.parse(fs.readFileSync(path.join(localesDir, `${lng}.json`), 'utf8')));
const placeholders = (v) =>
  new Set(typeof v === 'string' ? [...v.matchAll(/\{\{\s*(\w+)/g)].map((m) => m[1]) : []);
const baseKey = (k) => k.replace(PLURAL, '');

const en = load('en');
const enBase = new Set([...en.keys()].map(baseKey));

// Keys referenced from source
const used = new Map();
let dynamicCalls = 0;
const sources = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') walk(p);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) sources.push(p);
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, 'app'));
for (const file of sources) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\b(?:i18n\.)?t\(\s*(['"`])([^'"`$]+)\1/g)) {
    if (!used.has(m[2])) used.set(m[2], path.relative(root, file));
  }
  dynamicCalls += [...src.matchAll(/\b(?:i18n\.)?t\(\s*`[^`]*\$\{/g)].length;
  // Keys stored in constants and translated where they render
  for (const m of src.matchAll(/(['"])(ui_[A-Za-z]+\.[a-z0-9_]+)\1/g)) {
    if (!used.has(m[2])) used.set(m[2], path.relative(root, file));
  }
}

const errors = badKeyNames.map((k) => `JSON key contains '.': ${k}`);
for (const [key, file] of used) {
  if (!en.has(key) && !enBase.has(key)) errors.push(`missing in en.json: ${key} (${file})`);
}

// A real plural in English has both _one and _other
const pluralBases = new Set(
  [...en.keys()]
    .filter((k) => k.endsWith('_one') && en.has(k.replace(/_one$/, '_other')))
    .map(baseKey)
);
const isPluralKey = (k) => PLURAL.test(k) && pluralBases.has(baseKey(k));

for (const lng of languages.enabled.filter((l) => l !== 'en')) {
  const tr = load(lng);
  for (const [key, value] of en) {
    // Plural keys are checked per form below (languages have different forms)
    if (isPluralKey(key)) continue;
    if (!tr.has(key)) {
      errors.push(`[${lng}] missing: ${key}`);
      continue;
    }
    const a = placeholders(value),
      b = placeholders(tr.get(key));
    if (a.size !== b.size || [...a].some((p) => !b.has(p)))
      errors.push(`[${lng}] placeholder mismatch: ${key}`);
  }
  // Every plural category the language uses must exist, or i18next falls back
  // to English for that count (Arabic "few" for 3 to 10, for example)
  const categories = new Intl.PluralRules(lng).resolvedOptions().pluralCategories;
  for (const b of pluralBases) {
    const enPh = placeholders(en.get(`${b}_other`));
    for (const cat of categories) {
      const k = `${b}_${cat}`;
      if (!tr.has(k)) {
        errors.push(`[${lng}] missing plural form: ${k}`);
        continue;
      }
      // A form may leave the number out ("one cat"), but may not invent placeholders
      const ph = placeholders(tr.get(k));
      if ([...ph].some((p) => !enPh.has(p))) errors.push(`[${lng}] placeholder mismatch: ${k}`);
    }
  }
}

for (const lng of languages.draft) {
  const tr = load(lng);
  const have = [...en.keys()].filter((k) => tr.has(k)).length;
  console.info(`draft ${lng}: ${have}/${en.size} keys (${Math.round((100 * have) / en.size)}%)`);
}

const usedBase = new Set([...used.keys()]);
const unused = [...enBase].filter(
  (k) => !usedBase.has(k) && ![...usedBase].some((u) => k.startsWith(`${u}.`))
);
console.info(
  `en: ${en.size} keys, ${used.size} referenced statically, ${dynamicCalls} dynamic t() calls, ${unused.length} unreferenced`
);

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} translation error(s)`);
  process.exit(1);
}
console.info('i18n check passed');
