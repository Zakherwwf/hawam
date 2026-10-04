import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Alert, DevSettings, I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import languages from './languages.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import { setDisplayLocale } from '../utils/formatObservation';

/**
 * One language at a time. Only languages listed as "enabled" in
 * languages.json are selectable; CI's i18n:check fails if an enabled language
 * misses any key English has, so the app never falls back to English text
 * inside a French or Arabic screen. fallbackLng is a last resort only.
 *
 * Arabic is right-to-left: the whole layout mirrors (I18nManager). React
 * Native applies a direction change on the next launch, so switching between
 * Arabic and French/English reloads the app in development and asks for a
 * reopen in store builds.
 */
const catalogs: Record<string, object> = { en, fr, ar };
export const ENABLED_LANGUAGES: readonly string[] = languages.enabled;
export type AppLanguage = 'ar' | 'fr' | 'en';
const RTL_LANGUAGES = new Set(['ar']);
const STORAGE_KEY = 'hawem.language';

const resources = Object.fromEntries(
  ENABLED_LANGUAGES.filter((lng) => catalogs[lng]).map((lng) => [
    lng,
    { translation: catalogs[lng] },
  ])
);

/** The phone's language if the app speaks it, else the project default (Arabic). */
function deviceLanguage(): string {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
    if (ENABLED_LANGUAGES.includes(tag)) return tag;
  } catch {}
  return languages.default;
}

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4', // CLDR plural suffixes (_one, _few, _many, _other) via Intl.PluralRules
  resources,
  lng: deviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: [...ENABLED_LANGUAGES],
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => setDisplayLocale(lng));
setDisplayLocale(i18n.language);

/** Point the native layout direction at the language; true when it changed. */
function syncDirection(lng: string): boolean {
  const rtl = RTL_LANGUAGES.has(lng);
  try {
    I18nManager.allowRTL(rtl);
    if (I18nManager.isRTL !== rtl) {
      I18nManager.forceRTL(rtl);
      return true;
    }
  } catch {}
  return false;
}

/** Restore the saved choice at startup (falls back to the phone's language). */
export async function initAppLanguage() {
  let lng = i18n.language;
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && ENABLED_LANGUAGES.includes(saved)) lng = saved;
  } catch {}
  if (lng !== i18n.language) await i18n.changeLanguage(lng);
  // A direction set by an earlier choice applies now; a mismatch here (first
  // launch on an Arabic phone) is fixed for the next launch
  syncDirection(lng);
}

/**
 * Switch the whole app to one language and remember it. Texts change at
 * once; when the layout direction changes, the app reloads (development)
 * or asks to be reopened (store builds).
 */
export async function setAppLanguage(lng?: string) {
  const next = lng && ENABLED_LANGUAGES.includes(lng) ? lng : languages.default;
  await i18n.changeLanguage(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch {}
  if (!syncDirection(next)) return;
  const t = i18n.getFixedT(next);
  if (__DEV__) {
    Alert.alert(t('ui_settings_v3.layout_title'), t('ui_settings_v3.layout_body_dev'), [
      { text: t('ui_settings_v3.layout_restart'), onPress: () => DevSettings.reload() },
    ]);
  } else {
    Alert.alert(t('ui_settings_v3.layout_title'), t('ui_settings_v3.layout_body'), [
      { text: t('common.done') },
    ]);
  }
}

export default i18n;
