/**
 * Copy for the top-level ErrorBoundary fallback. Hardcoded English because a
 * render crash can coincide with i18n being unavailable — same reasoning as
 * `initFallbackCopy.ts`.
 */
export const ERROR_BOUNDARY_COPY = {
    title: 'Something went wrong',
    body: 'The app hit an unexpected error. Try again, or restart the app if the problem persists.',
    retry: 'Try again'
} as const;
