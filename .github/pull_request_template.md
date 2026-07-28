## What changed

<!-- One or two sentences. What behaviour is different now? -->

## Why

<!-- The problem this solves. Link the issue if there is one. -->

## How it was verified

<!-- Not "the gate is green" — what did you actually run and observe?
     Include the failure you reproduced first, if this is a fix. -->

- [ ] `npm run verify:ci` green locally (exit code checked without a pipe: `npm run verify:ci > log 2>&1; echo $?`)
- [ ] New behaviour is covered by a test that FAILS when the change is reverted
- [ ] Checked on a simulator or device, in both colour schemes, if any UI changed

## Ships over the air, or needs a native rebuild?

<!-- OTA-safe: JS logic, i18n strings, NativeWind classes, feature flags.
     Native rebuild + `version` bump: any `expo-*` dependency change, any
     `app.config.ts` native field (permissions, plugins, scheme), anything that
     changes `expo prebuild` output. Shipping a native change over the air is a
     silent no-op. -->

## Deliberately not touched

<!-- Scope discipline. Anything you noticed and left alone, and why.
     Discovered debt belongs in its own issue, not in this diff. -->

## Risks

<!-- What could this break that the gate would not catch?
     Say "none that I can see" if that is the honest answer. -->
