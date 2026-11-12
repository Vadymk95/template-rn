#!/usr/bin/env node
/**
 * fork:init — the local half of fork day, in one command, run once.
 *
 * Why it exists: a fork arrives with the template's name, title, version, release bootstrap and
 * decision history, and the README asked for a list of file edits to change that. Most of them are
 * checked by nothing, so a fork that skipped one kept the template's identity unnoticed, and the
 * step "start your own DECISIONS.md" was unsafe by hand: other docs point into its entries by heading
 * and `docs:check` fails the pointer that outlives its entry.
 *
 * What it does, in one pass over text (no install, no network, no `gh`, no git history touched):
 *   identity   the package name (manifest and both root entries of the lockfile), the Expo `slug`
 *              (the package name without its scope), the product title (the app's display name and
 *              its Dev and Preview labels in `app.config.ts`, the README heading), the package name
 *              in the README intro, the title line of the agent guide and of the project context,
 *              the licence holder when `--holder` is given. The list lives in `identitySpots`;
 *              each spot must match exactly the number of times written there, or the run refuses
 *              before writing anything (a template that drifted from this script is a refusal, not
 *              a half rename). The bundle identifier and the deep-link scheme are NOT rewritten:
 *              they hang on a reverse domain only the owner has, so the printed list names them.
 *   release    version `0.1.0` in the manifest, the lockfile root and the release manifest, an empty
 *              changelog, `bootstrap-sha` at the fork's current commit.
 *   origin     `.template-origin.json`: the template's name, version and commit. Its presence is how
 *              a second run is refused.
 *   decisions  `DECISIONS.md` starts over (header, empty index, a pointer at the template's version),
 *              and every `DECISIONS.md` § Heading pointer in the other docs becomes a quoted entry
 *              name plus the origin record, which `docs:check` does not pin to a heading.
 *   removal    the command leaves the fork it initialised: this script, its test, the `fork:init`
 *              entry of `package.json` and the README text that documents it (the owner decisions
 *              stay). The tree is written and removed first and `docs:check` judges that final
 *              tree; if it is red the command is put back whole, so a red run never leaves half of
 *              it. The refusal on `.template-origin.json` stays for a script copied back.
 *   --private  the `codeql` job and its required check leave together (a private repository without
 *              a code-scanning licence); every other CodeQL file stays.
 * Then it runs `docs:check` in the fork and prints what is left: the GitHub commands, in order, and
 * the choices only a person can make. It does NOT remove the template seeds: the Todo slice and the
 * start guide are live components with their own tests, and replacing them is the fork's own first
 * step (docs/template-reset.md).
 *
 * Refuses (nothing written): an unknown option, a missing or malformed value, a name Expo cannot
 * take as a slug, a dirty working tree, a directory that is not a git repository root with a commit,
 * a second run.
 *
 * Usage: npm run fork:init -- --name <package-name> --title "<Product Title>"
 *          [--holder "<Copyright holder>"] [--private] [--dry-run]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { isEntryPoint } from './is-entry-point.mjs';

export const ORIGIN_FILE = '.template-origin.json';
const FIRST_VERSION = '0.1.0';
const DECISIONS_FILE = '.cursor/brain/DECISIONS.md';
// History the template owns: other docs may keep their own words about it, these files are reset.
const HISTORY_FILES = new Set([DECISIONS_FILE, 'CHANGELOG.md']);
const SELF_FILES = ['scripts/fork-init.mjs', 'scripts/fork-init.test.mjs'];
const PACKAGE_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;
const NAME_MAX_LENGTH = 214;
// What Expo accepts for a slug: letters, digits, - and _, so no scope, dot or tilde.
const EXPO_SLUG = /^[a-z0-9_-]+$/;
const CODEQL_JOB = 'codeql';
const CODEQL_CONTEXT = 'CodeQL';
const CONTROL_CHARACTERS = /\p{Cc}/u;
const CAPTURE = ['ignore', 'pipe', 'pipe'];
// A child `git` must answer for the directory it runs in, not for a repository a hook exported.
const GIT_FREE_ENV = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))
);

/** A refusal is the script saying no on purpose: one line on stderr, exit 1, nothing written. */
export class Refusal extends Error {}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const escapeTsString = (text) => text.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const literal = (text) => new RegExp(escapeRegExp(text), 'g');
const slugOf = (name) => name.replace(/^@[^/]+\//, '');

const git = (root, ...args) =>
    execFileSync('git', args, { cwd: root, encoding: 'utf8', env: GIT_FREE_ENV, stdio: CAPTURE });

export const parseOptions = (argv) => {
    let values;
    try {
        ({ values } = parseArgs({
            args: argv,
            allowPositionals: false,
            strict: true,
            options: {
                name: { type: 'string' },
                title: { type: 'string' },
                holder: { type: 'string' },
                private: { type: 'boolean', default: false },
                'dry-run': { type: 'boolean', default: false }
            }
        }));
    } catch (error) {
        throw new Refusal(error.message);
    }
    const { name, title, holder } = values;
    if (name === undefined) throw new Refusal('--name is required');
    if (name.length > NAME_MAX_LENGTH || !PACKAGE_NAME.test(name)) {
        throw new Refusal(
            `--name "${name}" is not a package name npm accepts (lowercase letters, digits, - . _ ~, an optional @scope/, at most ${String(NAME_MAX_LENGTH)} characters, no leading . or _)`
        );
    }
    for (const [flag, value] of [
        ['--title', title],
        ['--holder', holder]
    ]) {
        if (value === undefined && flag === '--title') throw new Refusal('--title is required');
        if (value === undefined) continue;
        if (value.trim() === '') throw new Refusal(`${flag} must not be empty`);
        if (CONTROL_CHARACTERS.test(value)) throw new Refusal(`${flag} must be a single line`);
    }
    return {
        name,
        title: title.trim(),
        holder: holder?.trim(),
        private: values.private,
        dryRun: values['dry-run']
    };
};

/** The template's own identity, read from its files so the script names none of it. */
const readTemplate = (root) => {
    const read = (file) => readFileSync(path.join(root, file), 'utf8');
    const pkg = JSON.parse(read('package.json'));
    const title = /const getAppName = \(\) => \{[\s\S]*?return '([^']+)';\s*\};/.exec(
        read('app.config.ts')
    )?.[1];
    const holder = /^Copyright \(c\) \d{4} (.+)$/m.exec(read('LICENSE'))?.[1];
    if (!title || !holder) {
        throw new Refusal('app.config.ts has no getAppName() title or LICENSE no holder line');
    }
    return { name: pkg.name, version: pkg.version, title, holder };
};

/** Git must answer for this very directory, with a commit to start from and nothing uncommitted. */
const assertReady = (root) => {
    let top;
    try {
        top = git(root, 'rev-parse', '--show-toplevel').trim();
        git(root, 'rev-parse', '--verify', 'HEAD');
    } catch {
        throw new Refusal(
            'run it from the root of a git repository that has a commit (nothing is written without one)'
        );
    }
    if (realpathSync(top) !== realpathSync(root)) {
        throw new Refusal(`run it from the repository root (${top}), not from a subfolder`);
    }
    if (existsSync(path.join(root, ORIGIN_FILE))) {
        throw new Refusal(
            `fork:init already ran here: ${ORIGIN_FILE} exists. It runs once; edit the files by hand from here`
        );
    }
    if (git(root, 'status', '--porcelain', '--untracked-files=all').trim() !== '') {
        throw new Refusal(
            'the working tree is not clean: commit or discard your changes first, so one commit can hold the result'
        );
    }
};

/**
 * Where the template names itself. A spot is a pattern, how many times it must match, and what
 * replaces it; the order matters only inside one file.
 */
const identitySpots = ({ old, next }) => {
    const slug = slugOf(next.name);
    if (!EXPO_SLUG.test(slug)) {
        throw new Refusal(
            `--name "${next.name}" cannot be an Expo slug (letters, digits, - and _ once the @scope/ is dropped): app.config.ts slug is "${slug}"`
        );
    }
    const nameKey = (name) => `"name": ${JSON.stringify(name)}`;
    const spots = [
        {
            file: 'package.json',
            pattern: literal(nameKey(old.name)),
            count: 1,
            to: nameKey(next.name),
            note: 'package name'
        },
        {
            file: 'package-lock.json',
            pattern: new RegExp(
                `("name": )${escapeRegExp(JSON.stringify(old.name))}(,\\s+"version": )"${escapeRegExp(old.version)}"`,
                'g'
            ),
            count: 2,
            to: (_match, name, version) =>
                `${name}${JSON.stringify(next.name)}${version}"${FIRST_VERSION}"`,
            note: 'package name and version, both root entries'
        },
        {
            file: 'package.json',
            pattern: new RegExp(`^ {4}"version": "${escapeRegExp(old.version)}",$`, 'gm'),
            count: 1,
            to: `    "version": "${FIRST_VERSION}",`,
            note: `version restarts at ${FIRST_VERSION}`
        },
        {
            file: '.release-please-manifest.json',
            pattern: literal(`".": "${old.version}"`),
            count: 1,
            to: `".": "${FIRST_VERSION}"`,
            note: `release manifest restarts at ${FIRST_VERSION}`
        },
        {
            file: 'app.config.ts',
            pattern: literal(`slug: '${old.name}'`),
            count: 1,
            to: `slug: '${slug}'`,
            note: 'Expo slug'
        },
        {
            file: 'app.config.ts',
            pattern: literal(`'${old.title}`),
            count: 3,
            to: `'${escapeTsString(next.title)}`,
            note: 'app display name and its Dev and Preview labels'
        },
        {
            file: 'README.md',
            pattern: new RegExp(`^# ${escapeRegExp(old.name)}$`, 'gm'),
            count: 1,
            to: () => `# ${next.title}`,
            note: 'README heading'
        },
        {
            file: 'README.md',
            pattern: literal(`**\`${old.name}\`**`),
            count: 1,
            to: () => `**\`${next.name}\`**`,
            note: 'package name in the README intro'
        },
        {
            file: 'AGENTS.md',
            pattern: new RegExp(`^# ${escapeRegExp(old.name)}(?= )`, 'gm'),
            count: 1,
            to: `# ${next.name}`,
            note: 'agent guide title line'
        },
        {
            file: '.cursor/brain/PROJECT_CONTEXT.md',
            pattern: new RegExp(`^# ${escapeRegExp(old.name)}(?= )`, 'gm'),
            count: 1,
            to: `# ${next.name}`,
            note: 'project context title line'
        }
    ];
    if (next.holder !== undefined) {
        spots.push({
            file: 'LICENSE',
            pattern: /^(Copyright \(c\) \d{4}) .+$/gm,
            count: 1,
            to: (_match, head) => `${head} ${next.holder}`,
            note: 'licence holder'
        });
    }
    return spots;
};

const decisionsStart = (version) => `# DECISIONS — Why these, not others

History lives in \`git log -p -- ${DECISIONS_FILE}\` and the linked PRs. This file holds only
what is true today: an entry that stops being true is edited or deleted, never kept as a log. Each
entry has one row in the index below and holds at most 30 lines after its heading (\`docs:check\`
holds both): context, decision, consequences, status, evidence.

The template's decisions are not copied here. They stay in the template repository, at
version ${version} (\`${ORIGIN_FILE}\` names the commit): \`git log -p -- ${DECISIONS_FILE}\` there.

| Decision | Date | Status |
| -------- | ---- | ------ |
`;

// A pointer into the template's entries: `DECISIONS.md` § Heading, with the path as written, in
// backticks or not, or as a markdown link (`[`DECISIONS.md`](./DECISIONS.md)`, which is unwrapped to
// the plain path first so no bracket is left behind). The heading is a quoted phrase, which ends
// at its closing quote, or the words up to where the sentence takes over.
const DECISION_LINK = /\[(`?)DECISIONS\.md\1\]\([^)\s]*DECISIONS\.md\)(?=\s*§)/g;
const DECISION_POINTER =
    /(`?)(?:\.cursor\/brain\/)?DECISIONS\.md\1\s*§\s*(?:["“]([^"”\n]+)["”]|((?:[^`.,;()\n]|`[^`\n]*`)+))/g;

const unpinDecisionPointers = (text) =>
    text
        .replace(DECISION_LINK, '`DECISIONS.md`')
        .replace(DECISION_POINTER, (_match, _tick, quoted, words) =>
            quoted === undefined
                ? `the template's decision "${words.trim()}" (\`${ORIGIN_FILE}\`)${/\s$/.test(words) ? ' ' : ''}`
                : `the template's decision "${quoted.trim()}" (\`${ORIGIN_FILE}\`)`
        );

const removeJob = (text, job) => {
    const lines = text.split('\n');
    const start = lines.findIndex((line) => line === `    ${job}:`);
    if (start === -1) throw new Refusal(`.github/workflows/security.yml has no "${job}" job`);
    let end = start + 1;
    while (end < lines.length && !/^ {0,4}\S/.test(lines[end])) end += 1;
    lines.splice(start, end - start);
    return lines.join('\n');
};

const removeCodeqlCheck = (text) => {
    const kept = text
        .split('\n')
        .filter(
            (line) =>
                !new RegExp(`^\\s*\\{ "context": "${CODEQL_CONTEXT}[^"]*" \\},?\\s*$`).test(line)
        );
    if (kept.length === text.split('\n').length) {
        throw new Refusal('.github/ruleset.json has no required check for CodeQL');
    }
    const result = kept.join('\n');
    try {
        JSON.parse(result);
    } catch {
        throw new Refusal(
            '.github/ruleset.json would not stay valid JSON without its CodeQL entry'
        );
    }
    return result;
};

// The fork keeps the list of what its owner decides and a line on where it came from.
const FORK_README_INTRO = `This fork started from a template: \`${ORIGIN_FILE}\` names the template, its version and its commit. The one-time edits (name, title, version, release start, decision history) are done, and the command that made them is gone. These are yours to decide:`;

const applyCount = (text, { pattern, count, to, file }) => {
    const found = [...text.matchAll(pattern)].length;
    if (found !== count) {
        throw new Refusal(
            `${file}: expected ${String(count)} match(es) of ${String(pattern)}, found ${String(found)}; the template changed since this script was written`
        );
    }
    return text.replace(pattern, typeof to === 'function' ? to : () => to);
};

/** Every edit as { file, content, note }: nothing is written until the whole plan exists. */
export const buildPlan = ({ root, options, old, head }) => {
    const contents = new Map();
    const notes = new Map();
    const load = (file) => contents.get(file) ?? readFileSync(path.join(root, file), 'utf8');
    const put = (file, content, note) => {
        contents.set(file, content);
        notes.set(file, [...(notes.get(file) ?? []), note]);
    };

    for (const spot of identitySpots({ old, next: options })) {
        put(spot.file, applyCount(load(spot.file), spot), spot.note);
    }
    put('CHANGELOG.md', '# Changelog\n', 'changelog restarts empty');
    put(
        'release-please-config.json',
        applyCount(load('release-please-config.json'), {
            file: 'release-please-config.json',
            pattern: /("bootstrap-sha": ")[0-9a-f]{40}(")/g,
            count: 1,
            to: (_match, before, after) => `${before}${head}${after}`
        }),
        'bootstrap-sha at the fork’s current commit'
    );
    put(
        ORIGIN_FILE,
        `${JSON.stringify({ template: old.name, version: old.version, commit: head }, null, 4)}\n`,
        'origin record: template name, version, commit'
    );
    put(DECISIONS_FILE, decisionsStart(old.version), 'decision history starts over');

    const docs = git(root, 'ls-files', '*.md', '*.mdc').split('\n').filter(Boolean);
    for (const file of docs) {
        if (HISTORY_FILES.has(file)) continue;
        const before = load(file);
        const after = unpinDecisionPointers(before);
        if (after !== before) put(file, after, 'section pointers into the template’s decisions');
    }

    if (options.private) {
        const workflow = '.github/workflows/security.yml';
        put(workflow, removeJob(load(workflow), CODEQL_JOB), 'CodeQL job removed (--private)');
        const ruleset = '.github/ruleset.json';
        put(ruleset, removeCodeqlCheck(load(ruleset)), 'CodeQL required check removed (--private)');
    }
    return [...contents].map(([file, content]) => ({ file, content, notes: notes.get(file) }));
};

/** What leaves the two shared files with the command: its manifest entry and the README's account of it. */
const COMMAND_REMOVALS = {
    'package.json': {
        pattern: /,\n {8}"fork:init": "node scripts\/fork-init\.mjs"\n/g,
        to: '\n',
        note: 'fork:init entry removed'
    },
    'README.md': {
        pattern: /^After cloning[\s\S]*?^What it does not do, and you decide:$/gm,
        to: FORK_README_INTRO,
        note: 'fork checklist rewritten without the command'
    }
};

const withoutCommand = (plan) =>
    plan.map((edit) => {
        const removal = COMMAND_REMOVALS[edit.file];
        if (!removal) return edit;
        const { pattern, to, note } = removal;
        const content = applyCount(edit.content, {
            file: edit.file,
            pattern,
            count: 1,
            to: () => to
        });
        return { ...edit, content, notes: [...edit.notes, note] };
    });

const repositoryOf = (root) => {
    try {
        const url = git(root, 'remote', 'get-url', 'origin').trim();
        return /github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?$/.exec(url)?.[1] ?? 'OWNER/REPO';
    } catch {
        return 'OWNER/REPO';
    }
};

const branchOf = (root) => {
    try {
        return git(root, 'branch', '--show-current').trim() || 'main';
    } catch {
        return 'main';
    }
};

/** What no script here can do: GitHub settings in the order that costs least, and the choices left. */
export const remainingSteps = ({ repo, branch, version, private: isPrivate }) => [
    'Left to do, in this order. Nothing below was run for you.',
    '',
    '1. Review the result and commit it as one commit, then push:',
    `     git add -A && git commit -m "chore: start from template v${version}"`,
    '2. GitHub: enable Actions in the Actions tab (a fork starts with workflows disabled).',
    '3. GitHub: let Actions open the release pull request (or set the RELEASE_PLEASE_TOKEN secret',
    '   to a personal access token instead and skip the command):',
    `     gh api --method PUT repos/${repo}/actions/permissions/workflow -f default_workflow_permissions=read -F can_approve_pull_request_reviews=true`,
    '4. GitHub: create the label the gate-integrity check needs once:',
    `     gh label create gate-change --repo ${repo} --description "Reviewed change to a gate file"`,
    '5. Open one pull request and wait until every check has reported once. Only THEN post the',
    '   ruleset: a required check that never reported is Pending forever and blocks every pull request.',
    `     gh api --method POST repos/${repo}/rulesets --input .github/ruleset.json`,
    `     gh api repos/${repo}/rules/branches/${branch}`,
    '   The default branch must be main or master, or the branches: filters of ci.yml, release.yml',
    '   and security.yml need your branch name.',
    `6. GitHub settings that are only switches: secret scanning, push protection, Dependabot alerts${isPrivate ? '' : ', CodeQL'}.`,
    '   A team fork also adds a CODEOWNERS file over the paths in scripts/gate-files.json and turns',
    '   on required code-owner review.',
    '',
    'Choices only you can make:',
    '  - Native identity (app.config.ts): getBundleId() holds the iOS bundle identifier and the Android',
    '    package (com.example.templatern, with a .dev and a .preview variant) and scheme holds the',
    '    deep-link scheme (templatern). Both hang on a reverse domain you own, so this run kept them;',
    '    an unchanged one collides with the template on a device. Set MAESTRO_APP_ID to your bundle id',
    '    for npm run maestro.',
    '  - Assets: assets/icon.png, assets/splash.png and assets/adaptive-icon.png are placeholders.',
    '  - EAS (only if you use EAS Build or Update): eas project:create, then EAS_PROJECT_ID in CI',
    '    secrets and your local .env; check the profiles in eas.json.',
    '  - Languages: src/shared/locales/ and src/shared/lib/i18n/constants.ts (DEFAULT_NAMESPACES).',
    '  - LICENSE: MIT suits open source; for a proprietary app delete LICENSE and set "license":',
    '    "UNLICENSED" in package.json.',
    ...(isPrivate
        ? []
        : [
              '  - A private repository without a code-scanning licence: this run kept CodeQL. Delete the codeql',
              '    job and its required check by hand (README, "Pipelines — and which ones survive a private fork").'
          ]),
    '  - Keep the app at the git root, and keep scripts/version-holds.json.',
    '',
    'Template seeds (the Todo slice and the start guide) were left in place on purpose.',
    'To replace them when you are ready: docs/template-reset.md.'
];

const runDocsCheck = (root) => {
    if (!existsSync(path.join(root, 'scripts/docs-check.mjs'))) {
        return { ok: true, text: 'docs:check: skipped, scripts/docs-check.mjs is not there' };
    }
    try {
        execFileSync(process.execPath, ['scripts/docs-check.mjs'], {
            cwd: root,
            encoding: 'utf8',
            env: GIT_FREE_ENV,
            stdio: CAPTURE
        });
        return { ok: true, text: 'docs:check: green' };
    } catch (error) {
        return { ok: false, text: `docs:check: RED\n${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
};

export const forkInit = ({ root, argv }) => {
    const options = parseOptions(argv);
    assertReady(root);
    const old = readTemplate(root);
    if (options.name === old.name) {
        throw new Refusal(`--name must differ from the template's name (${old.name})`);
    }
    const head = git(root, 'rev-parse', 'HEAD').trim();
    const plan = buildPlan({ root, options, old, head });
    const final = withoutCommand(plan);
    const removed = SELF_FILES.map((file) => `  ${file}: removed with the command`);
    const lines = [];

    if (options.dryRun) {
        lines.push('fork:init dry run: nothing is written. Planned edits:');
        for (const { file, notes } of final) lines.push(`  ${file}: ${notes.join('; ')}`);
        return { ok: true, lines: [...lines, ...removed] };
    }
    const saved = SELF_FILES.map((file) => [file, readFileSync(path.join(root, file))]);
    for (const { file, content } of final) writeFileSync(path.join(root, file), content);
    for (const file of SELF_FILES) rmSync(path.join(root, file));
    lines.push(`fork:init wrote ${String(final.length)} files:`);
    for (const { file, notes } of final) lines.push(`  ${file}: ${notes.join('; ')}`);
    lines.push(...removed);

    const check = runDocsCheck(root);
    lines.push('', check.text);
    if (!check.ok) {
        for (const { file, content } of plan) writeFileSync(path.join(root, file), content);
        for (const [file, bytes] of saved) writeFileSync(path.join(root, file), bytes);
        lines.push(
            'The edits are written and the command is back whole; fix the findings above before committing.'
        );
        return { ok: false, lines };
    }
    lines.push(
        '',
        ...remainingSteps({
            repo: repositoryOf(root),
            branch: branchOf(root),
            version: old.version,
            private: options.private
        })
    );
    return { ok: true, lines };
};

const main = () => {
    try {
        const { ok, lines } = forkInit({ root: process.cwd(), argv: process.argv.slice(2) });
        console.log(lines.join('\n'));
        process.exitCode = ok ? 0 : 1;
    } catch (error) {
        if (!(error instanceof Refusal)) throw error;
        console.error(`fork:init: ${error.message}`);
        process.exitCode = 1;
    }
};

if (isEntryPoint(import.meta.url)) {
    main();
}
