import { render, type screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

type ByRoleArgs = Parameters<typeof screen.getByRole>;

/**
 * The role a text field exposes. A `TextInput` carries its role natively and never takes an
 * `accessibilityRole`, so it is resolved by its label instead of by a role prop.
 */
export const TEXT_FIELD_ROLE = 'textfield';

interface AccessibleControlSpec {
    /** An `accessibilityRole` / `role` value, or `TEXT_FIELD_ROLE` for a `TextInput`. */
    role: ByRoleArgs[0] | typeof TEXT_FIELD_ROLE;
    /** The name a screen reader announces: `accessibilityLabel`, `aria-label`, or the text inside. */
    name: NonNullable<NonNullable<ByRoleArgs[1]>['name']>;
}

/**
 * The accessibility guard for any interactive component. It renders `ui` and fails unless the
 * component exposes the expected role AND the expected accessible name, so a primitive that loses
 * its `accessibilityRole` or `accessibilityLabel` turns its test red. An icon-only control has no
 * text to fall back on, which is exactly the case this exists for.
 *
 * Apply it once per interactive component in that component's own test:
 *
 *     await expectAccessibleControl(<IconButton icon="close" accessibilityLabel="Close" />, {
 *         role: 'button',
 *         name: 'Close'
 *     });
 *
 * `src/test/uiA11yCoverage.test.ts` requires it in the test of every interactive primitive under
 * `src/shared/ui`. Returns the matched element for follow-up assertions.
 *
 * The check is made against props and roles. React Native Testing Library cannot measure layout,
 * so touch-target size and contrast are not covered here.
 */
export const expectAccessibleControl = async (
    ui: ReactElement,
    { role, name }: AccessibleControlSpec
): Promise<ReturnType<typeof screen.getByRole>> => {
    const { getByRole, getByLabelText } = await render(ui);

    return role === TEXT_FIELD_ROLE ? getByLabelText(name) : getByRole(role, { name });
};
