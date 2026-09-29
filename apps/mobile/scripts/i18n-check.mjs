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
const sources = [path.join(root, 'App.tsx')];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') walk(p);
    } else if (/\.(tsx?|jsx?)$/.test(e.name)) sources.push(p);
  }
})(path.join(root, 'src'));
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

for (const lng of languages.enabled.filter((l) => l !== 'en')) {
  const tr = load(lng);
  for (const [key, value] of en) {
    if (!tr.has(key)) {
      errors.push(`[${lng}] missing: ${key}`);
      continue;
    }
    const a = placeholders(value),
      b = placeholders(tr.get(key));
    if (a.size !== b.size || [...a].some((p) => !b.has(p)))
      errors.push(`[${lng}] placeholder mismatch: ${key}`);
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
