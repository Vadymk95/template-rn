/**
 * Copy for i18n bootstrap failure only (`I18nInitErrorFallback`). Never use `t()` there.
 */
export const I18N_INIT_FALLBACK_COPY = {
    title: 'Unable to load translations',
    body: 'Close and reopen the app. If the problem persists, check the install or contact support.',
    reloadDev: 'Reload (dev)',
    ok: 'OK'
} as const;
