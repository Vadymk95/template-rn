import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fireEvent, render } from '@testing-library/react-native';
import { createElement } from 'react';
import { Text } from 'react-native';

import { MAX_FONT_SCALE_IN_FIXED_CONTROL } from '@/shared/lib/theme/controlSizes';
import { Button } from '@/shared/ui/Button/Button';
import { STRESS_FONT_SCALE } from '@/test/contentStress';

describe('Button', () => {
    it('renders the label and calls onPress', async () => {
        const onPress = jest.fn();
        const { getByRole, getByText } = await render(
            <Button label="Create task" onPress={onPress} />
        );

        await fireEvent.press(getByRole('button'));

        expect(getByText('Create task')).toBeTruthy();
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders children instead of the label when custom content is provided', async () => {
        const { getByText, queryByText } = await render(
            <Button label="Hidden label">
                <Text>Custom content</Text>
            </Button>
        );

        expect(getByText('Custom content')).toBeTruthy();
        expect(queryByText('Hidden label')).toBeNull();
    });

    it('renders optional left and right slots', async () => {
        const leftSlot = createElement(Text, undefined, 'Left icon');
        const rightSlot = createElement(Text, undefined, 'Right icon');
        const { getByText } = await render(
            <Button label="Open" leftSlot={leftSlot} rightSlot={rightSlot} />
        );

        expect(getByText('Left icon')).toBeTruthy();
        expect(getByText('Open')).toBeTruthy();
        expect(getByText('Right icon')).toBeTruthy();
    });

    it('prevents presses while disabled or loading', async () => {
        const onPress = jest.fn();
        const disabledRender = await render(<Button label="Disabled" onPress={onPress} disabled />);

        await fireEvent.press(disabledRender.getByRole('button'));
        expect(onPress).not.toHaveBeenCalled();

        await disabledRender.unmount();

        const loadingRender = await render(<Button label="Loading" onPress={onPress} loading />);
        const loadingButton = loadingRender.getByRole('button');

        await fireEvent.press(loadingButton);

        expect(onPress).not.toHaveBeenCalled();
        expect(loadingButton.props['accessibilityState']).toEqual({
            busy: true,
            disabled: true
        });
    });

    it('warns in development when custom content buttons have no accessible label', async () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(jest.fn());

        await render(
            <Button>
                <Text>Custom content</Text>
            </Button>
        );

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            '[warn] [Button] Provide `label` or `accessibilityLabel` when rendering custom content.',
            ''
        );

        consoleWarnSpy.mockRestore();
    });

    it('bounds the label against the OS font scale, because the control height is fixed', () => {
        /*
         * Asserted against the SOURCE, not the rendered tree, and the reason is a measurement: the
         * rendered label carries only `className` and `children` — NativeWind's JSX interop re-creates
         * the element and the prop does not survive into what RNTL exposes. So a render assertion here
         * would be permanently red for a correct component, which is worse than no assertion. The prop
         * still reaches the native side at runtime; what a test can protect is that the module keeps
         * passing it.
         *
         * Why it matters: the control heights in `controlSizes.ts` are fixed and `<Text>` scales with
         * the system setting by default, so at the top of the accessibility slider the label is CLIPPED
         * rather than wrapped — the control still reports its 44 points while the words are cut off.
         */
        const source = readFileSync(join(process.cwd(), 'src/shared/ui/Button/Button.tsx'), 'utf8');

        expect(source).toContain('maxFontSizeMultiplier={MAX_FONT_SCALE_IN_FIXED_CONTROL}');
        // Never `allowFontScaling={false}` — that ignores the user's setting outright.
        expect(source).not.toContain('allowFontScaling={false}');
        expect(MAX_FONT_SCALE_IN_FIXED_CONTROL).toBeGreaterThan(1);
        expect(MAX_FONT_SCALE_IN_FIXED_CONTROL).toBeLessThan(STRESS_FONT_SCALE);
    });
});
