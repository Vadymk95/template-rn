import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import {
    START_GUIDE_COMMANDS,
    START_GUIDE_ENTRY_PATHS,
    START_GUIDE_READING,
    START_GUIDE_STEPS
} from '@/widgets/start-guide/constants';
import { StartGuideScreen } from '@/widgets/start-guide/StartGuideScreen';

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaConsumer: ({
        children
    }: {
        children: (insets: {
            top: number;
            right: number;
            bottom: number;
            left: number;
        }) => ReactNode;
    }) => children({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaInsets: () => ({
        top: 0,
        right: 0,
        bottom: 0,
        left: 0
    })
}));

const REPO_ROOT = process.cwd();

describe('StartGuideScreen', () => {
    it('reads the hero copy from the start namespace', async () => {
        const { getByText } = await render(<StartGuideScreen />);

        expect(getByText('start:title')).toBeTruthy();
        expect(getByText('start:description')).toBeTruthy();
        expect(getByText('start:seed')).toBeTruthy();
    });

    it('renders every section header', async () => {
        const { getByText } = await render(<StartGuideScreen />);

        for (const key of [
            'start:inside.title',
            'start:flow.title',
            'start:agents.title',
            'start:reading.title',
            'start:steps.title'
        ]) {
            expect(getByText(key)).toBeTruthy();
        }
    });

    it('renders the agent commands as they are typed', async () => {
        const { getByText } = await render(<StartGuideScreen />);

        for (const command of ['/onboard', '/feat', '/test', '/review', '/docs']) {
            expect(getByText(command)).toBeTruthy();
        }
        expect(getByText('start:agents.lead')).toBeTruthy();
        expect(getByText('start:agents.spec')).toBeTruthy();
    });

    it('renders the first-step commands as they are typed', async () => {
        const { getByText } = await render(<StartGuideScreen />);

        for (const command of ['npm run prepare', 'npm start', 'npm run verify:iter']) {
            expect(getByText(command)).toBeTruthy();
        }
    });

    it('renders the two entry documents under the hero', async () => {
        const { getByText } = await render(<StartGuideScreen />);

        expect(getByText('AGENTS.md')).toBeTruthy();
        expect(getByText('docs/strict-template-contract.md')).toBeTruthy();
    });

    // The screen is a pointer into the repo; a renamed brain file or a dropped script would leave it
    // lying to the first person who runs the app. The disk is the oracle here, not the constants.
    it('points only at files that exist in the tree', () => {
        const paths = [
            ...START_GUIDE_ENTRY_PATHS,
            ...START_GUIDE_READING.map((item) => item.code),
            ...START_GUIDE_STEPS.filter((item) => !item.code.startsWith('npm')).map(
                (item) => item.code
            )
        ];

        for (const relative of paths) {
            expect(existsSync(path.join(REPO_ROOT, relative))).toBe(true);
        }
    });

    it('names only agent commands that have a command file', () => {
        for (const item of START_GUIDE_COMMANDS) {
            const file = path.join(REPO_ROOT, '.claude/commands', `${item.code.slice(1)}.md`);
            expect(existsSync(file)).toBe(true);
        }
    });

    it('names only npm scripts that package.json defines', () => {
        const { scripts } = JSON.parse(
            readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')
        ) as { scripts: Record<string, string> };

        for (const item of START_GUIDE_STEPS) {
            if (!item.code.startsWith('npm')) {
                continue;
            }
            const script = item.code.replace(/^npm (run )?/, '');
            expect(scripts[script]).toBeDefined();
        }
    });
});
