# Security review (static) — template-rn

**Date:** 2026-04-19
**Scope:** Repository static review (dependency audit, configuration surface, secret patterns, client-side storage).
**Not in scope:** Licensed penetration test, OWASP ASVS full assessment, dynamic analysis on physical devices, reverse engineering of release binaries, social engineering, or infrastructure/cloud review outside this repo.

This document is **not** a certificate or attestation suitable for compliance frameworks that require a named third-party pentest firm.

---

## Methodology

| Step                                                                                                                | Result                                              |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `npm audit --json` (dev + prod tree)                                                                                | See findings                                        |
| Grep for high-risk patterns (`password`, `secret`, `apiKey`, `BEGIN PRIVATE`, hardcoded URLs with tokens) in `src/` | No critical hits in application code paths reviewed |
| Review `app.config.ts`, `src/env.ts`, `.env.example`, CI workflow permissions                                       | See below                                           |
| Review token persistence (`src/lib/secureToken.ts`, `src/store/user/userStore.ts`)                                  | See below                                           |

---

## Findings

### 1. npm audit (low severity, dev toolchain)

Transitive **low** findings may appear in the Jest / `jest-expo` / `jsdom` chain. Risk is primarily **CI/local test environment**, not production app binary. Mitigation: periodic `npm audit`, upgrade Jest ecosystem when upgrading Expo, avoid `npm audit fix --force` without reading breaking changes.

### 2. Public env vars (`EXPO_PUBLIC_*`)

Expo embeds `EXPO_PUBLIC_*` values into the client bundle. **Never** put secrets there. This template uses `@t3-oss/env-core` in `src/env.ts` — keep the schema aligned with `.env.example` and treat any future `EXPO_PUBLIC_*` as **world-readable**.

### 3. Secure storage

`secureToken` uses `expo-secure-store` for refresh-token-shaped data — appropriate for high-sensitivity strings on device. Revisit if you add web targets with different storage semantics.

### 4. Network / API surface

`queryClient` retry policy skips retries on 4xx — reduces accidental retry amplification on auth errors. Full API security (authZ, rate limits, CORS, etc.) is **backend** scope.

### 5. EAS / OTA

`app.config.ts` gates `extra.eas` / updates on `EAS_PROJECT_ID` — avoids accidental update channel misconfiguration in unconfigured clones. Production release signing and EAS project ACLs remain **Expo account** responsibilities.

### 6. CI

Workflow uses minimal `permissions` where applicable. Secrets in GitHub Actions must stay in **encrypted secrets**, not in workflow YAML.

---

## Recommendations (before production)

1. **Dependency policy:** Enable Dependabot or Renovate; review native dependency changes (they affect attack surface and store policies).
2. **Pre-release:** Run your org’s SAST/DAST on the API and mobile pipeline; add **certificate pinning** only if threat model requires it (operational cost).
3. **Store submission:** Complete platform privacy questionnaires using actual data practices (analytics, crash reporting, third-party SDKs).
4. **Bug bounty / pentest:** For high-stakes apps, commission a **scoped** mobile + API engagement with a licensed vendor; attach this static review as appendix only.

---

## Sign-off

This review was produced as **engineering hygiene** for the template repository. It does not replace professional penetration testing.
