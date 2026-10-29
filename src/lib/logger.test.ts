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

// A release build strips every `console.*` call except the methods named in the `exclude` list of
// transform-remove-console (babel.config.js). The logger writes through console.warn and
// console.error in every environment, so a method it writes that is not on that list would vanish
// from a release with no error anywhere. This case ties the two together.
describe('logger in a production build', () => {
    type BabelPlugin = string | [string, { exclude?: string[] }];
    type BabelConfigFactory = (api: { cache: jest.Mock }) => { plugins: BabelPlugin[] };

    const CONSOLE_METHODS = ['log', 'info', 'debug', 'warn', 'error'] as const;

    const methodsKeptByTheBuild = (): string[] => {
        const env = jest.replaceProperty(process.env, 'NODE_ENV', 'production');
        try {
            const config = jest.requireActual<BabelConfigFactory>('../../babel.config.js')({
                cache: jest.fn()
            });
            const removeConsole = config.plugins.find(
                (plugin): plugin is [string, { exclude?: string[] }] =>
                    Array.isArray(plugin) && plugin[0] === 'transform-remove-console'
            );
            return removeConsole?.[1].exclude ?? [];
        } finally {
            env.restore();
        }
    };

    const methodsTheLoggerWrites = (): string[] => {
        const spies = CONSOLE_METHODS.map(
            (method) => [method, jest.spyOn(console, method).mockImplementation(jest.fn())] as const
        );
        const env = jest.replaceProperty(process.env, 'NODE_ENV', 'production');
        try {
            jest.isolateModules(() => {
                const { logger: productionLogger } = require('@/lib/logger') as {
                    logger: typeof logger;
                };
                productionLogger.debug('debug');
                productionLogger.info('info');
                productionLogger.warn('warn');
                productionLogger.error('error', new Error('x'));
            });
            return spies.filter(([, spy]) => spy.mock.calls.length > 0).map(([method]) => method);
        } finally {
            env.restore();
            for (const [, spy] of spies) spy.mockRestore();
        }
    };

    it('writes only through console methods the build keeps', () => {
        const written = methodsTheLoggerWrites();
        const kept = methodsKeptByTheBuild();

        expect(written.length).toBeGreaterThan(0);
        expect(written.filter((method) => !kept.includes(method))).toEqual([]);
    });
});
