import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SPACING_TOKENS } from '@/shared/lib/theme/tokens';
import { Screen } from '@/shared/ui/Screen/Screen';

const FRAME = { x: 0, y: 0, width: 390, height: 844 };
const INSETS = { top: 44, bottom: 34, left: 0, right: 0 };

describe('Screen', () => {
    // The package ships its jest mock as `export default { ... }`. Wired without `.default`, every
    // named import of the package is undefined, so any component that reads the insets throws.
    it('gets a global safe-area mock whose named exports are functions', () => {
        expect(typeof useSafeAreaInsets).toBe('function');
        expect(typeof SafeAreaProvider).toBe('function');
    });

    it('renders its children with no safe-area mock of its own', async () => {
        const { getByText } = await render(
            <Screen>
                <Text>Body</Text>
            </Screen>
        );

        expect(getByText('Body')).toBeTruthy();
    });

    it('pads the content by the insets the provider supplies', async () => {
        const { root } = await render(
            <SafeAreaProvider initialMetrics={{ frame: FRAME, insets: INSETS }}>
                <Screen>
                    <Text>Body</Text>
                </Screen>
            </SafeAreaProvider>
        );

        expect(root).toHaveStyle({
            paddingTop: INSETS.top + SPACING_TOKENS.lg,
            paddingBottom: INSETS.bottom + SPACING_TOKENS['2xl']
        });
    });
});
