export const START_GUIDE_NAMESPACE = 'start';

export const START_GUIDE_COPY_KEYS = {
    title: 'title',
    description: 'description',
    seed: 'seed',
    inside: { title: 'inside.title' },
    flow: { title: 'flow.title' },
    agents: { title: 'agents.title', lead: 'agents.lead', spec: 'agents.spec' },
    reading: { title: 'reading.title' },
    steps: { title: 'steps.title' }
} as const;

/** Monospace treatment for a path or a command; the token ladder has no code step yet. */
export const START_GUIDE_CODE_CLASS_NAME = 'font-mono text-sm text-foreground';

/** The two documents under the hero: the guide every agent reads and the human-facing contract. */
export const START_GUIDE_ENTRY_PATHS = ['AGENTS.md', 'docs/strict-template-contract.md'] as const;

/** What ships, one row per package the copy names — nothing here that package.json does not have. */
export const START_GUIDE_INSIDE = [
    { id: 'expo', code: 'expo-router', copyKey: 'inside.expo' },
    { id: 'react', code: 'react-native', copyKey: 'inside.react' },
    { id: 'typescript', code: 'typescript', copyKey: 'inside.typescript' },
    { id: 'styling', code: 'nativewind', copyKey: 'inside.styling' },
    { id: 'state', code: 'zustand', copyKey: 'inside.state' },
    { id: 'env', code: '@t3-oss/env-core', copyKey: 'inside.env' },
    { id: 'i18n', code: 'i18next', copyKey: 'inside.i18n' },
    { id: 'testing', code: 'jest', copyKey: 'inside.testing' }
] as const;

/** The four moments of the gate, in the order they happen. */
export const START_GUIDE_FLOW = [
    { id: 'iterate', titleKey: 'flow.iterate.title', copyKey: 'flow.iterate.text' },
    { id: 'commit', titleKey: 'flow.commit.title', copyKey: 'flow.commit.text' },
    { id: 'push', titleKey: 'flow.push.title', copyKey: 'flow.push.text' },
    { id: 'ci', titleKey: 'flow.ci.title', copyKey: 'flow.ci.text' }
] as const;

/** Role commands: one row per file in `.claude/commands/`. */
export const START_GUIDE_COMMANDS = [
    { id: 'onboard', code: '/onboard', copyKey: 'agents.commands.onboard' },
    { id: 'feat', code: '/feat', copyKey: 'agents.commands.feat' },
    { id: 'test', code: '/test', copyKey: 'agents.commands.test' },
    { id: 'review', code: '/review', copyKey: 'agents.commands.review' },
    { id: 'docs', code: '/docs', copyKey: 'agents.commands.docs' }
] as const;

/** The brain files, in reading order. */
export const START_GUIDE_READING = [
    { id: 'index', code: '.cursor/brain/READING_INDEX.md', copyKey: 'reading.index' },
    { id: 'map', code: '.cursor/brain/MAP.md', copyKey: 'reading.map' },
    { id: 'skeletons', code: '.cursor/brain/SKELETONS.md', copyKey: 'reading.skeletons' },
    { id: 'verification', code: '.cursor/brain/VERIFICATION.md', copyKey: 'reading.verification' },
    { id: 'decisions', code: '.cursor/brain/DECISIONS.md', copyKey: 'reading.decisions' },
    { id: 'security', code: '.cursor/brain/SECURITY_REVIEW.md', copyKey: 'reading.security' }
] as const;

/** First steps after a clone; the last one points at the reset checklist instead of a command. */
export const START_GUIDE_STEPS = [
    { id: 'prepare', code: 'npm run prepare', copyKey: 'steps.prepare' },
    { id: 'dev', code: 'npm start', copyKey: 'steps.dev' },
    { id: 'iter', code: 'npm run verify:iter', copyKey: 'steps.iter' },
    { id: 'graduate', code: 'docs/template-reset.md', copyKey: 'steps.graduate' }
] as const;
