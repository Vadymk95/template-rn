import { Pressable, Text, TextInput } from 'react-native';

import { expectAccessibleControl, TEXT_FIELD_ROLE } from '@/test/a11y';

/**
 * The helper is the guard for every interactive primitive, so a helper that cannot fail would turn
 * every one of those tests into a pass. Each case below plants one defect and expects the helper to
 * reject it.
 */
describe('expectAccessibleControl', () => {
    it('accepts a control with the expected role and an explicit label', async () => {
        await expectAccessibleControl(
            <Pressable accessibilityRole="button" accessibilityLabel="Close">
                <Text>x</Text>
            </Pressable>,
            { role: 'button', name: 'Close' }
        );
    });

    it('accepts a name that comes from the text inside the control', async () => {
        await expectAccessibleControl(
            <Pressable accessibilityRole="button">
                <Text>Try again</Text>
            </Pressable>,
            { role: 'button', name: 'Try again' }
        );
    });

    it('rejects a control that lost its role', async () => {
        await expect(
            expectAccessibleControl(
                <Pressable accessibilityLabel="Close">
                    <Text>x</Text>
                </Pressable>,
                { role: 'button', name: 'Close' }
            )
        ).rejects.toThrow(/role: button/);
    });

    it('rejects an icon-only control that lost its label', async () => {
        await expect(
            expectAccessibleControl(<Pressable accessibilityRole="button" />, {
                role: 'button',
                name: 'Close'
            })
        ).rejects.toThrow(/name: Close/);
    });

    it('rejects a control whose label is not the expected one', async () => {
        await expect(
            expectAccessibleControl(
                <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" />,
                { role: 'button', name: 'Close' }
            )
        ).rejects.toThrow(/name: Close/);
    });

    it('resolves a text field by its label, because a TextInput has no role prop', async () => {
        await expectAccessibleControl(<TextInput accessibilityLabel="Task title" />, {
            role: TEXT_FIELD_ROLE,
            name: 'Task title'
        });
    });

    it('rejects a text field that lost its label', async () => {
        await expect(
            expectAccessibleControl(<TextInput />, { role: TEXT_FIELD_ROLE, name: 'Task title' })
        ).rejects.toThrow(/Task title/);
    });
});
