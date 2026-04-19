import './resources';

import * as Localization from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from '../../locales/en/common.json';
import errorsEn from '../../locales/en/errors.json';
import homeEn from '../../locales/en/home.json';
import notFoundEn from '../../locales/en/notFound.json';
import settingsEn from '../../locales/en/settings.json';

import {
    DEFAULT_LANGUAGE,
    DEFAULT_NAMESPACE,
    DEFAULT_NAMESPACES,
    SUPPORTED_LANGUAGES,
    type SupportedLanguage
} from './constants';

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
        notFound: notFoundEn
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
