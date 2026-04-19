// Built-in jest matchers are auto-registered by any `@testing-library/react-native` import.
// `@testing-library/jest-native/extend-expect` is deprecated and no longer needed.

import type { ReactNode } from 'react';

process.env['EXPO_PUBLIC_API_URL'] ||= 'https://api.example.com';
process.env['EXPO_PUBLIC_ENV'] ||= 'development';

jest.mock('expo-localization', () => ({
    getLocales: () => [{ languageCode: 'en', regionCode: 'US', textDirection: 'ltr' }]
}));

jest.mock('react-i18next', () => ({
    I18nextProvider: ({ children }: { children: ReactNode }) => children,
    useTranslation: (ns?: string | readonly string[]) => {
        const prefix = typeof ns === 'string' ? ns : ns?.[0];
        return {
            t: (key: string) => (prefix ? `${prefix}:${key}` : key),
            i18n: {
                changeLanguage: jest.fn(() => Promise.resolve()),
                isInitialized: true,
                language: 'en'
            }
        };
    }
}));

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Silence Reanimated warnings in tests
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Silence NativeWind className warnings in tests
jest.mock('nativewind', () => ({
    styled: (component: unknown) => component,
    useColorScheme: () => ({ colorScheme: 'light', setColorScheme: jest.fn() })
}));
