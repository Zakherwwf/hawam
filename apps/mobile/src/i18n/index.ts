import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import en from './locales/en.json';

// Enforce standard Left-to-Right layout and disable RTL completely
try {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
} catch {}

const resources = {
  en: { translation: en },
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export const setAppLanguage = (_lng?: string) => {
  try {
    I18nManager.allowRTL(false);
    I18nManager.forceRTL(false);
  } catch {}
  i18n.changeLanguage('en');
};

export default i18n;
