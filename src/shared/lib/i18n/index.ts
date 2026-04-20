// Scale note: all namespaces loaded statically (1 locale × 6 NS today).
// When SUPPORTED_LANGUAGES grows past 2, migrate to lazy namespace
// load via i18next.addResourceBundle on language change. See
// PROJECT_CONTEXT.md → "Full scope: strengths vs deferred tools".

import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import {
    DEFAULT_LANGUAGE,
    DEFAULT_NAMESPACE,
    DEFAULT_NAMESPACES,
    SUPPORTED_LANGUAGES,
    type SupportedLanguage
} from '@/shared/lib/i18n/constants';
import '@/shared/lib/i18n/resources';
import commonEn from '@/shared/locales/en/common.json';
import errorsEn from '@/shared/locales/en/errors.json';
import homeEn from '@/shared/locales/en/home.json';
import notFoundEn from '@/shared/locales/en/notFound.json';
import settingsEn from '@/shared/locales/en/settings.json';
import todoEn from '@/shared/locales/en/todo.json';

const resolveInitialLanguage = (): SupportedLanguage => {
    const code = Localization.getLocales().at(0)?.languageCode;
    if (code && SUPPORTED_LANGUAGES.includes(code as SupportedLanguage)) {
        return code as SupportedLanguage;
    }
    return DEFAULT_LANGUAGE;
};

const bundledResources = {
    en: {
        common: commonEn,
        errors: errorsEn,
        home: homeEn,
        settings: settingsEn,
        notFound: notFoundEn,
        todo: todoEn
    }
} as const;

const i18nInitPromise = i18next.use(initReactI18next).init({
    resources: bundledResources,
    lng: resolveInitialLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: DEFAULT_NAMESPACE,
    ns: [...DEFAULT_NAMESPACES],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    compatibilityJSON: 'v4'
});

export default i18next;
export { i18nInitPromise };
