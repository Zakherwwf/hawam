import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import languages from './languages.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';

/**
 * Only languages listed as "enabled" in languages.json are selectable at
 * runtime; drafts are bundled but never activated. To ship a language, bring
 * it to 100 % (CI's i18n:check enforces this for enabled languages) and move
 * it from "draft" to "enabled".
 */
const catalogs: Record<string, object> = { en, fr, ar };
export const ENABLED_LANGUAGES: readonly string[] = languages.enabled;

const resources = Object.fromEntries(
  ENABLED_LANGUAGES.filter((lng) => catalogs[lng]).map((lng) => [
    lng,
    { translation: catalogs[lng] },
  ])
);

// Layout stays left-to-right until an RTL language is enabled
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch {}

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4', // CLDR plural suffixes (_one, _few, _many, _other) via Intl.PluralRules
  resources,
  lng: languages.default,
  fallbackLng: 'en',
  supportedLngs: [...ENABLED_LANGUAGES],
  interpolation: {
    escapeValue: false,
  },
});

export const setAppLanguage = (lng?: string) => {
  i18n.changeLanguage(lng && ENABLED_LANGUAGES.includes(lng) ? lng : languages.default);
};

export default i18n;
