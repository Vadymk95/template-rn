// Side-effect module: augments i18next so `t()` keys are checked against bundled JSON.
// Import this file once before any `t()` call (see `index.ts`).

import type commonEn from '@/shared/locales/en/common.json';
import type errorsEn from '@/shared/locales/en/errors.json';
import type homeEn from '@/shared/locales/en/home.json';
import type notFoundEn from '@/shared/locales/en/notFound.json';
import type settingsEn from '@/shared/locales/en/settings.json';
import type todoEn from '@/shared/locales/en/todo.json';

declare module 'i18next' {
    interface CustomTypeOptions {
        defaultNS: 'common';
        resources: {
            common: typeof commonEn;
            errors: typeof errorsEn;
            home: typeof homeEn;
            settings: typeof settingsEn;
            notFound: typeof notFoundEn;
            todo: typeof todoEn;
        };
    }
}
