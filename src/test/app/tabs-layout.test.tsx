import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';
import { COLOR_VALUES } from '@/shared/lib/theme/colors';

// The shared `expo-router` mock renders children and drops props, so `screenOptions`
// is invisible to it. This file's mock captures them instead — without that, a test
// asserting the tab tint would pass no matter what the layout passed.
const capturedScreenOptions: { tabBarActiveTintColor?: string }[] = [];

jest.mock('expo-router', () => ({
    Tabs: Object.assign(
        ({
            children,
            screenOptions
        }: {
            children: ReactNode;
            screenOptions?: { tabBarActiveTintColor?: string };
        }) => {
            if (screenOptions) {
                capturedScreenOptions.push(screenOptions);
            }
            return children;
        },
        { Screen: (): null => null }
    )
}));

const mockUseColorScheme = jest.fn();

jest.mock('nativewind', () => ({
    useColorScheme: () => mockUseColorScheme()
}));

const renderWithScheme = async (colorScheme: 'light' | 'dark' | null): Promise<void> => {
    mockUseColorScheme.mockReturnValue({ colorScheme, setColorScheme: jest.fn() });
    await render(<TabsLayout />);
};

describe('TabsLayout', () => {
    beforeEach(() => {
        capturedScreenOptions.length = 0;
        mockUseColorScheme.mockReset();
    });

    it('tints the active tab with the light foreground under the light scheme', async () => {
        await renderWithScheme('light');

        expect(capturedScreenOptions[0]?.tabBarActiveTintColor).toBe(
            COLOR_VALUES.light.textPrimary
        );
    });

    it('tints the active tab with the DARK foreground under the dark scheme', async () => {
        // The regression this guards: a fixed light value made the active tab
        // near-black on a near-black bar, effectively invisible in dark mode.
        await renderWithScheme('dark');

        expect(capturedScreenOptions[0]?.tabBarActiveTintColor).toBe(COLOR_VALUES.dark.textPrimary);
        expect(capturedScreenOptions[0]?.tabBarActiveTintColor).not.toBe(
            COLOR_VALUES.light.textPrimary
        );
    });

    it('falls back to the light foreground when the scheme is not resolved yet', async () => {
        await renderWithScheme(null);

        expect(capturedScreenOptions[0]?.tabBarActiveTintColor).toBe(
            COLOR_VALUES.light.textPrimary
        );
    });
});
