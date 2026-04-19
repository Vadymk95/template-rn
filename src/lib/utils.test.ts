import { cn } from '@/lib/utils';

describe('cn', () => {
    it('joins class segments with clsx (no tailwind-merge on native)', () => {
        expect(cn('px-2', 'px-4')).toBe('px-2 px-4');
    });

    it('omits undefined class segments', () => {
        expect(cn('base', undefined, 'block')).toBe('base block');
    });
});
