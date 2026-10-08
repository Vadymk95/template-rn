import { FilterChip } from '@/shared/ui/FilterChip/FilterChip';
import { expectAccessibleControl } from '@/test/a11y';

describe('FilterChip', () => {
    it('exposes a button role and its label', async () => {
        await expectAccessibleControl(<FilterChip label="Open tasks" />, {
            role: 'button',
            name: 'Open tasks'
        });
    });
});
