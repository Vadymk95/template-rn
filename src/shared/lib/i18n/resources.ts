// Side-effect module: augments i18next so `t()` keys are checked against bundled JSON.
// Import this file once before any `t()` call (see `index.ts`).

import type commonEn from '../../locales/en/common.json';
import type errorsEn from '../../locales/en/errors.json';
import type homeEn from '../../locales/en/home.json';
import type notFoundEn from '../../locales/en/notFound.json';
import type settingsEn from '../../locales/en/settings.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
        resources: {
            common: typeof commonEn;
            errors: typeof errorsEn;
            home: typeof homeEn;
            settings: typeof settingsEn;
            notFound: typeof notFoundEn;
        };
    }
}
