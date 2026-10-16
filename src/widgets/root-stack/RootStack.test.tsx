import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { RootStack } from '@/widgets/root-stack/RootStack';

// The shared `expo-router` mock gives `Stack` no `Screen` member and drops props. This file's mock
// records each declared screen instead, because the screens and their options are the contract.
const declaredScreens: { name: string; options: unknown }[] = [];

jest.mock('expo-router', () => ({
    Stack: Object.assign(({ children }: { children: ReactNode }) => children, {
        Screen: ({ name, options }: { name: string; options?: unknown }): null => {
            declaredScreens.push({ name, options });
            return null;
        }
    })
}));

describe('RootStack', () => {
    beforeEach(() => {
        declaredScreens.length = 0;
    });

    it('declares the tab group as the one screen, without a header of its own', async () => {
        await render(<RootStack />);

        expect(declaredScreens).toEqual([{ name: '(tabs)', options: { headerShown: false } }]);
    });
});
