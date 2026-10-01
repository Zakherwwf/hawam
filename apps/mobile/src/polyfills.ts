/**
 * Global Polyfills & Patches for React Native / Hermes Engine
 *
 * Problem:
 * Hermes has a minimal native C++ implementation of TextDecoder that strictly expects
 * 'utf-8'. When third-party packages or Emscripten-compiled libraries (e.g. h3-js) call:
 *   new TextDecoder("utf8")
 *   new TextDecoder("utf-16le")
 * Hermes immediately throws:
 *   RangeError: Unknown encoding: utf8
 * causing "runtime not ready" on app launch in Expo Go / React Native.
 *
 * Solution:
 * This polyfill intercepts TextDecoder construction globally, normalizes 'utf8' to
 * 'utf-8', and safely falls back to 'utf-8' for unsupported encodings rather than throwing.
 */

// Intl.PluralRules for i18next's CLDR plural keys (_one/_other/...). Some
// Hermes builds (Android Expo Go) ship without it, and i18next then falls back
// to v3 plural handling, rendering raw keys. Each import only installs itself
// when the runtime lacks the API. Order matters: PluralRules needs Locale,
// which needs getCanonicalLocales. Add locale data when enabling a language.
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/ar.js';

if (typeof globalThis !== 'undefined') {
  const OriginalTextDecoder = (globalThis as any).TextDecoder;

  if (typeof OriginalTextDecoder !== 'undefined') {
    function SafeTextDecoder(this: any, encoding: string = 'utf-8', options?: any) {
      try {
        const clean =
          typeof encoding === 'string'
            ? encoding
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
            : '';
        const normalized = clean === 'utf8' ? 'utf-8' : encoding;
        return new (OriginalTextDecoder as any)(normalized, options);
      } catch (err) {
        // Fallback to utf-8 when Hermes rejects unsupported encodings
        return new (OriginalTextDecoder as any)('utf-8', options);
      }
    }

    SafeTextDecoder.prototype = OriginalTextDecoder.prototype;
    (globalThis as any).TextDecoder = SafeTextDecoder;
  }
}

export {};
