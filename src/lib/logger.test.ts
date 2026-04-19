import { logger } from '@/lib/logger';

describe('logger', () => {
    it('exposes stable API surface', () => {
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
    });

    it('error logs with console.error', () => {
        const spy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
        logger.error('unit', new Error('x'), { k: 1 });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
