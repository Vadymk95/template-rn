// Guards the Dependabot auto-merge workflow and its one script: that a patch or a minor asks GitHub to
// enable auto-merge, that nothing else does, and that the job never merges, approves or runs the pull
// request's code.
//
// Runner: `node:test` (see gate-trace.test.mjs for why). Run via `npm run test:scripts`.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';

// Resolved from the repo root, as the other script tests do.
const ROOT = process.cwd();
const WORKFLOW_PATH = '.github/workflows/dependabot-auto-merge.yml';
const SCRIPT_PATH = 'scripts/dependabot-auto-merge.sh';
const DECIDE_ID = 'decide';

const PATCH = 'version-update:semver-patch';
const MINOR = 'version-update:semver-minor';
const MAJOR = 'version-update:semver-major';

const REPOSITORY = 'owner/repo';
const BASE_REF = 'master';
const PR_NUMBER = '109';
const PR_NODE_ID = 'PR_node_109';
const WORKFLOW_BOT = 'github-actions[bot]';

const readIfExists = (file) =>
    existsSync(path.join(ROOT, file)) ? readFileSync(path.join(ROOT, file), 'utf8') : '';

const workflow = readIfExists(WORKFLOW_PATH);
const script = readIfExists(SCRIPT_PATH);

const withoutComments = (text) =>
    text
        .split('\n')
        .filter((line) => !line.trim().startsWith('#'))
        .join('\n');

const indentOf = (line) => line.length - line.trimStart().length;

/** The lines nested deeper than the key at `index` (blank lines inside the block are kept). */
const nestedLines = (lines, index) => {
    let end = index + 1;
    while (
        end < lines.length &&
        (lines[end].trim() === '' || indentOf(lines[end]) > indentOf(lines[index]))
    )
        end += 1;
    return lines.slice(index + 1, end);
};

/** The one job of the workflow, whatever its id. */
const theJob = () => {
    const lines = withoutComments(workflow).split('\n');
    const jobsAt = lines.indexOf('jobs:');
    if (jobsAt === -1) return [];
    const first = lines.findIndex((line, at) => at > jobsAt && /^ {4}[\w-]+:\s*$/.test(line));
    return first === -1 ? [] : nestedLines(lines, first);
};

/** A scalar key of the job itself (8 spaces), not of a step. */
const jobKey = (lines, key) => {
    const line = lines.find((candidate) => candidate.startsWith(`        ${key}:`));
    return line?.slice(line.indexOf(':') + 1).trim();
};

/** The `key: value` pairs nested under `key:` at `indent` spaces. */
const mapUnder = (lines, key, indent) => {
    const start = lines.findIndex((line) => line === `${' '.repeat(indent)}${key}:`);
    if (start === -1) return null;
    return Object.fromEntries(
        nestedLines(lines, start)
            .filter((line) => line.trim() !== '')
            .map((line) => {
                const at = line.indexOf(':');
                return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
            })
    );
};

/** The steps of the job: each a list of lines, the first starting with `- ` at 12 spaces. */
const stepsOf = (lines) => {
    const steps = [];
    for (const line of lines) {
        if (/^ {12}- /.test(line)) steps.push([line]);
        else if (steps.length > 0) steps.at(-1).push(line);
    }
    return steps;
};

const stepUsing = (name) =>
    stepsOf(theJob()).find((step) => step.some((line) => line.includes(`uses: ${name}@`)));

const decideStep = () =>
    stepsOf(theJob()).find((step) => step.some((line) => line.trim().endsWith(`id: ${DECIDE_ID}`)));

const decideEnv = () => mapUnder(decideStep() ?? [], 'env', 14);

const tempDirs = [];
after(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** `string` contains `part`; the message shows the string when it does not. */
const assertIncludes = (string, part, message) =>
    assert.ok(
        string.includes(part),
        message ?? `expected ${JSON.stringify(string)} to contain ${JSON.stringify(part)}`
    );

/** `string` does not contain `part`. */
const assertExcludes = (string, part) =>
    assert.ok(
        !string.includes(part),
        `expected ${JSON.stringify(string)} not to contain ${JSON.stringify(part)}`
    );

// A stand-in `gh` that records every call and answers from canned API responses, applying the
// call's own `--jq` filter with the real jq, so the filters in the script are tested against the
// response shapes GitHub sends. A call it does not know exits 99, so a merge, a review or any other
// command the script has no business with is loud.
const FAKE_GH = `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_GH_LOG"
filter=""
prev=""
for arg in "$@"; do
    if [ "$prev" = "--jq" ]; then filter="$arg"; fi
    prev="$arg"
done
serve() {
    if [ -n "$filter" ]; then printf '%s' "$1" | jq -r "$filter"; else printf '%s' "$1"; fi
}
fail() { echo "$1" >&2; exit 1; }
case "$*" in
    *enablePullRequestAutoMerge*)
        if [ -n "$FAKE_ENABLE_ERROR" ]; then fail "$FAKE_ENABLE_ERROR"; fi
        echo '{"data":{}}' ;;
    *disablePullRequestAutoMerge*) echo '{"data":{}}' ;;
    *rules/branches/*)
        if [ -n "$FAKE_RULES_ERROR" ]; then fail "$FAKE_RULES_ERROR"; fi
        if [ -n "$FAKE_RULES_RAW" ]; then printf '%s' "$FAKE_RULES_RAW"; exit 0; fi
        serve "$FAKE_RULES_JSON" ;;
    *repos/*/branches/*)
        if [ -n "$FAKE_BRANCH_ERROR" ]; then fail "$FAKE_BRANCH_ERROR"; fi
        serve "$FAKE_BRANCH_JSON" ;;
    *repos/*/pulls/*) serve "$FAKE_PULL_JSON" ;;
    *repos/*) serve "$FAKE_REPO_JSON" ;;
    *) echo "unexpected gh call: $*" >&2; exit 99 ;;
esac
`;

// Response shapes as GitHub sends them (read from the live API on this repository, trimmed).
const RULES_REQUIRED = JSON.stringify([
    { type: 'deletion' },
    {
        type: 'required_status_checks',
        parameters: {
            required_status_checks: [{ context: 'validate (24.x)' }, { context: 'gate-integrity' }],
            strict_required_status_checks_policy: false
        }
    }
]);
const RULES_NONE = JSON.stringify([{ type: 'deletion' }, { type: 'non_fast_forward' }]);
const RULES_EMPTY_LIST = JSON.stringify([
    { type: 'required_status_checks', parameters: { required_status_checks: [] } }
]);
const BRANCH_NO_CHECKS = JSON.stringify({
    protected: true,
    protection: {
        enabled: false,
        required_status_checks: { enforcement_level: 'off', contexts: [], checks: [] }
    }
});
const BRANCH_UNPROTECTED = JSON.stringify({ protected: false });
const BRANCH_CLASSIC_CONTEXTS = JSON.stringify({
    protected: true,
    protection: {
        enabled: true,
        required_status_checks: {
            enforcement_level: 'everyone',
            contexts: ['validate'],
            checks: []
        }
    }
});
const BRANCH_CLASSIC_CHECKS = JSON.stringify({
    protected: true,
    protection: {
        enabled: true,
        required_status_checks: {
            enforcement_level: 'everyone',
            contexts: [],
            checks: [{ context: 'validate', app_id: 15368 }]
        }
    }
});
const NO_REQUEST = JSON.stringify({ auto_merge: null });
const requestBy = (login) =>
    JSON.stringify({ auto_merge: { enabled_by: { login }, merge_method: 'squash' } });

/** Runs the script file against the fake `gh`; returns the exit code, the output and the gh calls. */
const runScript = ({
    updateType = '',
    metadataOutcome = 'success',
    allowAutoMerge = true,
    rules = RULES_REQUIRED,
    branch = BRANCH_NO_CHECKS,
    pull = NO_REQUEST,
    enableError = '',
    rulesError = '',
    branchError = '',
    rulesRaw = ''
}) => {
    assert.ok(existsSync(path.join(ROOT, SCRIPT_PATH)), `${SCRIPT_PATH} is missing`);
    const dir = mkdtempSync(path.join(tmpdir(), 'auto-merge-'));
    tempDirs.push(dir);
    const log = path.join(dir, 'gh.log');
    writeFileSync(log, '');
    writeFileSync(path.join(dir, 'gh'), FAKE_GH);
    chmodSync(path.join(dir, 'gh'), 0o755);
    const result = spawnSync('bash', [SCRIPT_PATH], {
        cwd: ROOT,
        encoding: 'utf8',
        env: {
            PATH: `${dir}:${process.env.PATH}`,
            REPOSITORY,
            BASE_REF,
            PR_NUMBER,
            PR_NODE_ID,
            UPDATE_TYPE: updateType,
            METADATA_OUTCOME: metadataOutcome,
            FAKE_GH_LOG: log,
            FAKE_REPO_JSON: JSON.stringify({ allow_auto_merge: allowAutoMerge }),
            FAKE_RULES_JSON: rules,
            FAKE_BRANCH_JSON: branch,
            FAKE_PULL_JSON: pull,
            FAKE_ENABLE_ERROR: enableError,
            FAKE_RULES_ERROR: rulesError,
            FAKE_BRANCH_ERROR: branchError,
            FAKE_RULES_RAW: rulesRaw
        }
    });
    const calls = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    return {
        status: result.status,
        output: `${result.stdout}${result.stderr}`,
        calls,
        enables: calls.filter((call) => call.includes('enablePullRequestAutoMerge')),
        disables: calls.filter((call) => call.includes('disablePullRequestAutoMerge'))
    };
};

describe('a patch or a minor asks GitHub to enable auto-merge, with the squash method', () => {
    for (const [name, type] of [
        ['patch', PATCH],
        ['minor', MINOR]
    ]) {
        it(`a ${name} update sends exactly one enable request and switches nothing off`, () => {
            const run = runScript({ updateType: type });
            assert.equal(run.status, 0, run.output);
            assert.equal(run.enables.length, 1, `gh calls: ${run.calls.join(' | ')}`);
            assertIncludes(run.enables[0], 'mergeMethod: SQUASH');
            assertIncludes(run.enables[0], PR_NODE_ID);
            assert.deepEqual(run.disables, []);
        });
    }

    it('a request already pending on a patch is left alone', () => {
        const run = runScript({ updateType: PATCH, pull: requestBy(WORKFLOW_BOT) });
        assert.equal(run.status, 0, run.output);
        assert.deepEqual(run.disables, []);
    });
});

describe('the base branch needs a required status check before anything is requested', () => {
    for (const [name, sources] of [
        ['a ruleset', { rules: RULES_REQUIRED, branch: BRANCH_NO_CHECKS }],
        ['classic protection (contexts)', { rules: RULES_NONE, branch: BRANCH_CLASSIC_CONTEXTS }],
        ['classic protection (checks)', { rules: RULES_NONE, branch: BRANCH_CLASSIC_CHECKS }],
        ['both', { rules: RULES_REQUIRED, branch: BRANCH_CLASSIC_CONTEXTS }]
    ]) {
        it(`with ${name} the request is sent`, () => {
            const run = runScript({ updateType: MINOR, ...sources });
            assert.equal(run.status, 0, run.output);
            assert.equal(run.enables.length, 1, `gh calls: ${run.calls.join(' | ')}`);
        });
    }

    for (const [name, rules, branch] of [
        ['rules without a status check and an unprotected branch', RULES_NONE, BRANCH_UNPROTECTED],
        ['no rules at all and a protection with empty lists', '[]', BRANCH_NO_CHECKS],
        ['a status-check rule with an empty list', RULES_EMPTY_LIST, BRANCH_NO_CHECKS]
    ]) {
        it(`with ${name}: green, no request, one line that says nothing is required`, () => {
            const run = runScript({ updateType: PATCH, rules, branch });
            assert.equal(run.status, 0, run.output);
            assert.deepEqual(run.enables, [], `gh calls: ${run.calls.join(' | ')}`);
            assert.match(run.output, /no required status check/i);
            assert.match(run.output, /nothing to wait for/i);
        });
    }

    it('asks both sources, on the base branch the workflow names', () => {
        const run = runScript({ updateType: PATCH });
        assert.ok(
            run.calls.some((call) =>
                call.includes(`repos/${REPOSITORY}/rules/branches/${BASE_REF}`)
            )
        );
        assert.ok(
            run.calls.some((call) => call.includes(`repos/${REPOSITORY}/branches/${BASE_REF}`))
        );
    });

    for (const [name, failure, message] of [
        ['the rules read', { rulesError: 'HTTP 500 rules' }, 'HTTP 500 rules'],
        ['the branch read', { branchError: 'HTTP 500 branch' }, 'HTTP 500 branch'],
        [
            'a rules answer of an unexpected shape',
            { rules: JSON.stringify({ message: 'Not Found' }) },
            ''
        ]
    ]) {
        it(`${name} failing ends red with no request, never as "nothing" or "something" required`, () => {
            for (const rules of [RULES_REQUIRED, RULES_NONE]) {
                const run = runScript({ updateType: PATCH, rules, ...failure });
                assert.notEqual(run.status, 0, run.output);
                assert.deepEqual(run.enables, [], `gh calls: ${run.calls.join(' | ')}`);
                if (message) assertIncludes(run.output, message);
            }
        });
    }
});

describe('an answer that is not a count', () => {
    it('ends red with the answer shown and no request, and never evaluates it', () => {
        const run = runScript({ updateType: PATCH, rulesRaw: 'a[$(touch /tmp/never)]' });
        assert.notEqual(run.status, 0, run.output);
        assert.deepEqual(run.enables, []);
        assertIncludes(run.output, 'Unexpected answer');
    });
});

describe('anything else enables nothing', () => {
    for (const [name, input] of [
        ['a major', { updateType: MAJOR }],
        ['an unknown update type', { updateType: 'version-update:semver-unheard-of' }],
        ['an empty update type', { updateType: '' }],
        ['metadata that could not be read', { updateType: PATCH, metadataOutcome: 'failure' }],
        ['metadata that was skipped', { updateType: MINOR, metadataOutcome: 'skipped' }]
    ]) {
        it(`${name}: no enable request, the line says why, and no GitHub read of settings is needed`, () => {
            const run = runScript(input);
            assert.equal(run.status, 0, run.output);
            assert.deepEqual(run.enables, [], `gh calls: ${run.calls.join(' | ')}`);
            assert.match(run.output, /not enabled/i);
        });
    }
});

describe('only a request this workflow made is taken back', () => {
    const NOT_QUALIFYING = { updateType: MAJOR };

    it('a request made by the workflow is switched off, once, and the line says so', () => {
        const run = runScript({ ...NOT_QUALIFYING, pull: requestBy(WORKFLOW_BOT) });
        assert.equal(run.status, 0, run.output);
        assert.deepEqual(run.enables, []);
        assert.equal(run.disables.length, 1, `gh calls: ${run.calls.join(' | ')}`);
        assertIncludes(run.disables[0], PR_NODE_ID);
        assert.match(run.output, /switched off/i);
    });

    it('a request a person made stays, and the line names the person', () => {
        const run = runScript({ ...NOT_QUALIFYING, pull: requestBy('a-reviewer') });
        assert.equal(run.status, 0, run.output);
        assert.deepEqual(run.disables, []);
        assertIncludes(run.output, 'a-reviewer');
    });

    it('with no request pending nothing is switched off', () => {
        const run = runScript({ ...NOT_QUALIFYING, pull: NO_REQUEST });
        assert.equal(run.status, 0, run.output);
        assert.deepEqual(run.disables, []);
    });

    for (const [name, input] of [
        ['an unknown update type', { updateType: 'something-new' }],
        ['metadata that could not be read', { updateType: '', metadataOutcome: 'failure' }]
    ]) {
        it(`${name} with a request by the workflow: exactly one disable request`, () => {
            const run = runScript({ ...input, pull: requestBy(WORKFLOW_BOT) });
            assert.equal(run.status, 0, run.output);
            assert.deepEqual(run.enables, []);
            assert.equal(run.disables.length, 1, `gh calls: ${run.calls.join(' | ')}`);
        });
    }
});

describe('a repository that does not allow auto-merge', () => {
    it('ends green with one line that names the setting, and sends no enable request', () => {
        const run = runScript({ updateType: MINOR, allowAutoMerge: false });
        assert.equal(run.status, 0, run.output);
        assert.deepEqual(run.enables, [], `gh calls: ${run.calls.join(' | ')}`);
        assertIncludes(run.output, 'Allow auto-merge');
    });
});

describe('GitHub refuses the enable request', () => {
    const MESSAGE = 'Pull request is in clean status';

    it('ends red, shows GitHub message, and says what to do with a pull request that can merge at once', () => {
        const run = runScript({ updateType: PATCH, enableError: MESSAGE });
        assert.notEqual(run.status, 0, run.output);
        assertIncludes(run.output, MESSAGE);
        assert.match(run.output, /nothing to wait for/i);
        assertIncludes(run.output, '@dependabot rebase');
        assert.match(run.output, /merges? it by hand|a human merges/i);
    });
});

describe('the job never merges, approves or bypasses', () => {
    it('the script calls no merge or review command and passes no admin or bypass flag', () => {
        const code = withoutComments(script);
        assert.notEqual(code, '', `${SCRIPT_PATH} is missing or empty`);
        assert.doesNotMatch(code, /\bpr\s+(merge|review)\b/);
        assert.doesNotMatch(code, /--(admin|auto|bypass|squash|merge|rebase|approve)\b/);
        assert.doesNotMatch(
            code,
            /\b(mergePullRequest|addPullRequestReview|enableAutoMerge|bypass)/i
        );
    });

    it('every gh call the fake saw, in every case, was an api call', () => {
        const cases = [
            { updateType: PATCH },
            { updateType: MINOR },
            { updateType: MAJOR, pull: requestBy(WORKFLOW_BOT) },
            { updateType: MAJOR, pull: requestBy('someone') },
            { updateType: PATCH, allowAutoMerge: false },
            { updateType: PATCH, rules: RULES_NONE, branch: BRANCH_UNPROTECTED },
            { updateType: PATCH, enableError: 'refused' }
        ];
        const calls = cases.flatMap((input) => runScript(input).calls);
        assert.ok(calls.length > 0);
        assert.deepEqual(
            calls.filter((call) => !call.startsWith('api ')),
            []
        );
    });

    it('starts with strict shell options', () => {
        assert.match(withoutComments(script).trim().split('\n')[0], /^#!|^set -eo pipefail$/);
        assert.match(script, /^set -eo pipefail$/m);
    });
});

describe('the workflow file', () => {
    it('exists', () => {
        assert.notEqual(workflow, '', `${WORKFLOW_PATH} is missing`);
    });

    it('triggers on pull_request and names the other pull-request trigger nowhere', () => {
        const lines = workflow.split('\n');
        const onAt = lines.indexOf('on:');
        assert.ok(onAt > -1, 'the workflow needs a top-level `on:`');
        assert.ok(nestedLines(lines, onAt).some((line) => /^ {4}pull_request:/.test(line)));
        assertExcludes(workflow, 'pull_request_target');
    });

    it('runs only for pull requests opened by Dependabot, decided from the author in the payload', () => {
        const condition = jobKey(theJob(), 'if');
        assert.notEqual(condition, undefined, 'the job needs an `if:`');
        assertIncludes(condition, 'github.event.pull_request.user.login');
        assertIncludes(condition, "'dependabot[bot]'");
        assertExcludes(condition, 'github.actor');
    });

    it('keeps a read-only floor and gives the job exactly the two write scopes', () => {
        const lines = withoutComments(workflow).split('\n');
        assert.deepEqual(mapUnder(lines, 'permissions', 0), { contents: 'read' });
        assert.deepEqual(mapUnder(theJob(), 'permissions', 8), {
            contents: 'write',
            'pull-requests': 'write'
        });
    });

    it('pins every action by a 40-character commit SHA with a version comment', () => {
        const uses = workflow.split('\n').filter((line) => /^\s*(- )?uses:/.test(line));
        assert.ok(uses.length > 1, 'the job needs the metadata action and the checkout');
        for (const line of uses) {
            assert.match(line, /@[0-9a-f]{40} # v\d/, `${line.trim()} is not pinned`);
        }
    });

    it('has a timeout and one concurrency group per pull request', () => {
        assert.match(jobKey(theJob(), 'timeout-minutes') ?? '', /^\d+$/);
        const lines = withoutComments(workflow).split('\n');
        assertIncludes(
            mapUnder(lines, 'concurrency', 0)?.group ?? '',
            'github.event.pull_request.number'
        );
    });

    it('keeps the metadata step from failing the job, so the decision step always runs', () => {
        const metadata = stepUsing('dependabot/fetch-metadata');
        assert.notEqual(metadata, undefined, 'the job needs a dependabot/fetch-metadata step');
        const text = (metadata ?? []).join('\n');
        assert.match(text, /^ {14}continue-on-error: true$/m);
        assert.doesNotMatch(text, /skip-(commit-)?verification/);
    });
});

describe('the job runs the base branch copy of one script, never the pull request code', () => {
    const checkouts = () =>
        stepsOf(theJob()).filter((step) =>
            step.some((line) => line.includes('uses: actions/checkout@'))
        );

    it('has exactly one checkout, before the decision step', () => {
        assert.equal(checkouts().length, 1);
        const steps = stepsOf(theJob());
        const at = (name) => steps.findIndex((step) => step.some((line) => line.includes(name)));
        assert.ok(at('actions/checkout@') > -1);
        assert.ok(at('actions/checkout@') < at(`id: ${DECIDE_ID}`));
    });

    it('checks out the base ref, not the head', () => {
        const checkout = checkouts()[0] ?? [];
        assert.equal(
            mapUnder(checkout, 'with', 14)?.ref,
            '${{ github.event.pull_request.base.ref }}'
        );
        assert.doesNotMatch(
            withoutComments(workflow),
            /pull_request\.head|head\.sha|head\.ref|github\.sha|head_ref|refs\/pull\//
        );
    });

    it('is sparse to the one script and keeps no credentials', () => {
        const options = mapUnder(checkouts()[0] ?? [], 'with', 14);
        assert.equal(options?.['sparse-checkout'], SCRIPT_PATH);
        assert.equal(options?.['sparse-checkout-cone-mode'], 'false');
        assert.equal(options?.['persist-credentials'], 'false');
    });

    it('runs exactly that script as the one line of the decision step', () => {
        const step = decideStep() ?? [];
        const runLines = step.filter((line) => /^ {14}run:/.test(line));
        assert.deepEqual(runLines, [`              run: bash ${SCRIPT_PATH}`]);
        assert.equal(
            step.some((line) => /^ {14}run: [|>]/.test(line)),
            false
        );
    });

    it('hands every value to the script through env', () => {
        assertExcludes(withoutComments(script), '${{');
        const env = decideEnv() ?? {};
        const expected = {
            GH_TOKEN: '${{ github.token }}',
            REPOSITORY: '${{ github.repository }}',
            BASE_REF: '${{ github.event.pull_request.base.ref }}',
            PR_NUMBER: '${{ github.event.pull_request.number }}',
            PR_NODE_ID: '${{ github.event.pull_request.node_id }}',
            UPDATE_TYPE: '${{ steps.metadata.outputs.update-type }}',
            METADATA_OUTCOME: '${{ steps.metadata.outcome }}'
        };
        for (const [key, value] of Object.entries(expected)) assert.equal(env[key], value, key);
        for (const name of Object.keys(env).filter((key) => key !== 'GH_TOKEN')) {
            assertIncludes(script, name, `the script never reads $${name}`);
        }
    });

    it('runs the decision step under bash', () => {
        assert.ok((decideStep() ?? []).some((line) => /^ {14}shell: bash$/.test(line)));
    });
});
