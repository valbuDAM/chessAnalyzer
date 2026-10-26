import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import es from './es.json';

export const defaultNS = 'translation';
export const resources = { es: { [defaultNS]: es } } as const;

await i18n.use(initReactI18next).init({
  lng: 'es',
  fallbackLng: 'es',
  resources,
  interpolation: { escapeValue: false }, // React ya escapa
});

export default i18n;
