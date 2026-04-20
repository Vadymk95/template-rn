import { render, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import RootLayout from '@/app/_layout';
import { I18N_INIT_FALLBACK_COPY } from '@/shared/lib/constants/initFallbackCopy';

jest.mock('../../../global.css', () => ({}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaConsumer: ({
        children
    }: {
        children: (insets: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        }) => ReactNode;
    }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaInsets: () => ({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    })
}));

jest.mock('@/hooks/useStoreReady', () => ({
    useStoreReady: (): boolean => true
}));

jest.mock('@/app/_RootStack', () => ({
    RootStack: (): ReactElement | null => null
}));

jest.mock('@/lib/logger', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('@/shared/lib/i18n', () => {
    const i18nInitPromise = Promise.reject(new Error('i18n bootstrap failed'));
    void i18nInitPromise.catch(() => undefined);
    return {
        __esModule: true,
        default: {
            isInitialized: false
        },
        i18nInitPromise
    };
});

describe('RootLayout', () => {
    it('renders the i18n init error fallback when i18next bootstrap fails', async () => {
        const { getByText } = render(<RootLayout />);

        await waitFor(() => {
            expect(getByText(I18N_INIT_FALLBACK_COPY.title)).toBeTruthy();
        });

        expect(getByText(I18N_INIT_FALLBACK_COPY.body)).toBeTruthy();
    });
});
