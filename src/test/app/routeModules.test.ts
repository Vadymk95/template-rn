import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_DIR = join(process.cwd(), 'src/app');

// Expo Router treats EVERY file under the routes directory as a route and warns on each development
// start about one with no default export. It skips only these special modules (`getRoutesCore.js`).
const NOT_A_ROUTE = /(?:^|\/)\+(?:html|native-intent|middleware)\.[tj]sx?$|\+api\.[tj]sx?$/;
const DEFAULT_EXPORT = /^export\s+default\b|^export\s*\{[^}]*\bas\s+default\b/m;

const listModules = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? listModules(join(dir, entry.name))
            : /\.tsx?$/.test(entry.name)
              ? [join(dir, entry.name)]
              : []
    );

const readSources = (): Record<string, string> =>
    Object.fromEntries(
        listModules(APP_DIR).map((file) => [
            file.slice(APP_DIR.length + 1),
            readFileSync(file, 'utf8')
        ])
    );

/** The modules that expo-router would load as routes but that export no default component. */
const findWithoutDefaultExport = (sources: Record<string, string>): string[] =>
    Object.entries(sources)
        .filter(([file]) => !NOT_A_ROUTE.test(file))
        .filter(([, source]) => !DEFAULT_EXPORT.test(source))
        .map(([file]) => file);

/**
 * A helper dropped next to the routes is a route to expo-router. Its only trace is a warning on every
 * start, so the check is made here: `src/app` holds route modules and nothing else. Shared UI belongs
 * in `src/widgets` or `src/shared`, which the route files import.
 */
describe('route modules', () => {
    it('exports a default component from every module under src/app', () => {
        const sources = readSources();

        expect(Object.keys(sources)).toContain('_layout.tsx');
        expect(findWithoutDefaultExport(sources)).toEqual([]);
    });

    it('reports a helper module that exports no default component', () => {
        expect(
            findWithoutDefaultExport({
                '_Helper.tsx': 'export const Helper = () => null;',
                'tasks.tsx': 'const Tasks = () => null;\nexport default Tasks;'
            })
        ).toEqual(['_Helper.tsx']);
    });

    it('accepts a default export in either spelling and the modules expo-router skips', () => {
        expect(
            findWithoutDefaultExport({
                'index.tsx': 'const Home = () => null;\nexport default Home;',
                'settings.tsx': 'const Settings = () => null;\nexport { Settings as default };',
                '+html.tsx': 'export const Html = () => null;',
                '+native-intent.ts': 'export const redirectSystemPath = () => "/";',
                'orders+api.ts': 'export const GET = () => null;',
                '(tabs)/+middleware.ts': 'export const middleware = () => null;'
            })
        ).toEqual([]);
    });
});
