export const SUPPORTED_LANGUAGES = ['en'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/** Bundled at build time — add new JSON under `src/shared/locales/<lng>/` and extend here. */
export const DEFAULT_NAMESPACES = [
    'common',
    'errors',
    'home',
    'settings',
    'notFound',
    'todo'
] as const;

export const LAZY_NAMESPACES = [] as const;

export const ALL_NAMESPACES = [...DEFAULT_NAMESPACES, ...LAZY_NAMESPACES] as const;

export const DEFAULT_NAMESPACE = DEFAULT_NAMESPACES[0];

export type Namespace = (typeof ALL_NAMESPACES)[number];
