#!/usr/bin/env node
/**
 * Runs the coverage suite and refuses a run whose coverage silently describes FEWER files than it should.
 *
 * Why this exists, measured on THIS stack rather than ported: when a file inside the coverage scope cannot
 * be parsed, jest prints `Failed to collect coverage from <file>` — and then **exits 0**. The percentage
 * that follows is computed over the surviving files, so it can even go UP. A threshold gate cannot see it:
 * the number it checks is honest about a set that quietly shrank. Verified with an unparseable file in
 * `src/lib/`: 103 tests passed, coverage reported an unchanged 95.51%, exit code 0.
 *
 * The sibling web templates carry the same guard against vitest's wording (`Excluding it from coverage`).
 * The marker differs per runner, which is exactly why this was measured before being wired: a grep for a
 * string nobody has seen is decoration.
 *
 * Marker-based on purpose. A file-count baseline is the stronger guard in a real application, but in a
 * TEMPLATE it would record the file count of an empty scaffold and need editing on every commit.
 *
 * Usage: node scripts/check-coverage.mjs
 */
import { spawnSync } from 'node:child_process';

/** Jest's own wording, copied from a measured run. */
const DROPOUT_MARKER = 'Failed to collect coverage from';

/**
 * Pure, so the decision is testable without running a suite. Returns the offending lines, so the failure
 * message can name the files instead of just asserting that something happened.
 */
export const findCoverageDropouts = (output) =>
    String(output)
        .split('\n')
        .filter((line) => line.includes(DROPOUT_MARKER));

const main = () => {
    // `--no-install` so a missing or incomplete `node_modules` cannot make npx fetch a different jest
    // from the network and gate on a tool this repo does not pin.
    const result = spawnSync('npx', ['--no-install', 'jest', '--coverage'], {
        encoding: 'utf8',
        shell: false
    });

    // Captured rather than inherited, because the guard has to READ the output. Echo it back first so the
    // run looks the same as before.
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');

    // Verdict BEFORE any normalisation: `status === null` means the child died on a signal (an
    // out-of-memory kill on a large suite is the realistic cause), and that must never read as a pass.
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }

    const dropouts = findCoverageDropouts(`${result.stdout ?? ''}\n${result.stderr ?? ''}`);

    if (dropouts.length > 0) {
        console.error(
            `\n✖ coverage dropout: ${String(dropouts.length)} file(s) were excluded from the report after failing to parse.`
        );
        for (const line of dropouts) {
            console.error(`  ${line.trim()}`);
        }
        console.error(
            '\nThe percentage above describes a SMALLER set of files than the coverage scope, and jest exits 0 on its own.\n'
        );
        process.exit(1);
    }
};

// Guarded so importing this module for a test does not run the suite.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
    main();
}
