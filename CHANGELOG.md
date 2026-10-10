# Changelog

## [0.3.1](https://github.com/Vadymk95/template-rn/compare/v0.3.0...v0.3.1) (2026-10-10)


### Bug fixes

* **api:** stop retrying 4xx through safeFetch; refuse agent-memory imports in docs ([#43](https://github.com/Vadymk95/template-rn/issues/43)) ([1c2a134](https://github.com/Vadymk95/template-rn/commit/1c2a134bcfd1a31d1c1cf38038f075c05ebae87f))
* **ci:** audit workflows with zizmor and stop persisting checkout credentials ([#41](https://github.com/Vadymk95/template-rn/issues/41)) ([32af113](https://github.com/Vadymk95/template-rn/commit/32af1136d07068d0f0c681bde4128266b2813955))
* **deps:** floor handlebars at 4.7.10 for three new advisories ([#46](https://github.com/Vadymk95/template-rn/issues/46)) ([fb2e4bf](https://github.com/Vadymk95/template-rn/commit/fb2e4bf382e590b4aceaead2df63269b23c84205))
* **gate:** docs:check flags CI steps that bypass the gate and ruleset drift ([#36](https://github.com/Vadymk95/template-rn/issues/36)) ([bb1584c](https://github.com/Vadymk95/template-rn/commit/bb1584cf34159215f632d0aaca082b777f765101))
* **gate:** suppressions need a reason, bundle budget in CI, a11y guard on UI primitives ([#45](https://github.com/Vadymk95/template-rn/issues/45)) ([448bca0](https://github.com/Vadymk95/template-rn/commit/448bca01c1f5a325c34f628b8d611db6fbacbf1f))
* **harness:** lock-age and Node-floor guards, private-fork gitleaks permission ([#49](https://github.com/Vadymk95/template-rn/issues/49)) ([516b466](https://github.com/Vadymk95/template-rn/commit/516b4660bbe4ed8463b19471bc61b22b5cb14c02))
* **native:** guard cleartext config, drop four unused native deps, pin actions by SHA ([#39](https://github.com/Vadymk95/template-rn/issues/39)) ([a5afcd2](https://github.com/Vadymk95/template-rn/commit/a5afcd2ca94a7e80cca6a573610699dd923ebde7))
* **theme:** native colours match global.css, enable no-empty, fix stale docs ([#38](https://github.com/Vadymk95/template-rn/issues/38)) ([4ae66e3](https://github.com/Vadymk95/template-rn/commit/4ae66e3ea29c62069ceeb3cf5d4530f4f906fcf5))


### Maintenance

* **deps:** newest Expo SDK 57 patches and compatible packages; holds recorded ([#44](https://github.com/Vadymk95/template-rn/issues/44)) ([aa1f7de](https://github.com/Vadymk95/template-rn/commit/aa1f7deea2bc7565b4318240ddbf85863c906be1))


### Documentation

* **brain:** integration recipes for icons, device info, auth, OTA and crash reports ([#42](https://github.com/Vadymk95/template-rn/issues/42)) ([2990832](https://github.com/Vadymk95/template-rn/commit/2990832711cacc2d89920429c2e2b8a95da81058))
* **brain:** record the rejected RN accessibility engine ([#48](https://github.com/Vadymk95/template-rn/issues/48)) ([db70ca4](https://github.com/Vadymk95/template-rn/commit/db70ca44db40dd858f2ffa143d0078ac1719f811))
* **harness:** slim agent docs, enforce version holds, resolve section pointers ([#47](https://github.com/Vadymk95/template-rn/issues/47)) ([580df4d](https://github.com/Vadymk95/template-rn/commit/580df4d61746d6dc03789f48ad7bc90c7aec8fc2))

## [0.3.0](https://github.com/Vadymk95/template-rn/compare/v0.2.2...v0.3.0) (2026-10-02)


### Features

* **agents:** committed limits deny force pushes, skipped hooks and env reads in every mode ([e05f975](https://github.com/Vadymk95/template-rn/commit/e05f9757d9d3b2bb7e6190c9bc47a9af5cf3b6a5))


### Bug fixes

* **deps:** raise the brace-expansion floor and date-allow node-forge, which has no fix ([1f90e46](https://github.com/Vadymk95/template-rn/commit/1f90e469025f92e1bcbbd544017af59b9d42a0fc))


### Maintenance

* **deps:** bump the minor-and-patch group with 2 updates ([#33](https://github.com/Vadymk95/template-rn/issues/33)) ([4d31cf8](https://github.com/Vadymk95/template-rn/commit/4d31cf870f9b73e8ed8698c6053c74b4b2431975))


### Documentation

* **agents:** a red push re-runs only what failed, then pushes again ([ff0a2fc](https://github.com/Vadymk95/template-rn/commit/ff0a2fc6633e3da39edc79b6d4871b81b6633d39))


### CI

* **deps:** one weekly Dependabot PR for minor and patch, so the lock file stops conflicting ([268bd6e](https://github.com/Vadymk95/template-rn/commit/268bd6e3cc8f4c79884b30174c58ac65797ce7b1))
* **release:** release-please prefers a RELEASE_PLEASE_TOKEN secret when one is set ([1ea8ee4](https://github.com/Vadymk95/template-rn/commit/1ea8ee40c401d0373cc15986119547259ccc7376))

## [0.2.2](https://github.com/Vadymk95/template-rn/compare/v0.2.1...v0.2.2) (2026-09-27)


### Maintenance

* **deps:** bump the development-dependencies group across 1 directory with 7 updates ([#30](https://github.com/Vadymk95/template-rn/issues/30)) ([d0538d3](https://github.com/Vadymk95/template-rn/commit/d0538d391e64479dea6c5d1e094d7a9b82c55456))
* **deps:** bump the production-dependencies group with 4 updates ([#27](https://github.com/Vadymk95/template-rn/issues/27)) ([48e1a1d](https://github.com/Vadymk95/template-rn/commit/48e1a1d8234c0f88177793f825fcbd01895cde7c))


### CI

* **deps:** bump googleapis/release-please-action in the actions group ([#26](https://github.com/Vadymk95/template-rn/issues/26)) ([68855af](https://github.com/Vadymk95/template-rn/commit/68855af466403b73bead8835680adc0624c4df36))

## [0.2.1](https://github.com/Vadymk95/template-rn/compare/v0.2.0...v0.2.1) (2026-09-13)


### Bug fixes

* **ci:** a fork that renames its default branch no longer loses CI and protection ([#25](https://github.com/Vadymk95/template-rn/issues/25)) ([d86894a](https://github.com/Vadymk95/template-rn/commit/d86894a0865629fe0f02d92710c273f6936017fb))
* **gate:** give the push budget a recency window so it can recover ([ef8821f](https://github.com/Vadymk95/template-rn/commit/ef8821f74104d564b63c3c0ae58522ab08c4d3a4))
* **gate:** let release-please own the changelog format instead of the checker ([c5a14c2](https://github.com/Vadymk95/template-rn/commit/c5a14c2258f39f5c7a47a20c3bdadaa08eb184e4))
* **gate:** make jest and eslint blind to an agent worktree inside the repo ([ad638a3](https://github.com/Vadymk95/template-rn/commit/ad638a3f40aae7a0d946a7d87a1c12593e8dd667))
* **gate:** the push budget calibrates to the machine it runs on, not to mine ([#23](https://github.com/Vadymk95/template-rn/issues/23)) ([26e538d](https://github.com/Vadymk95/template-rn/commit/26e538d5c9cbd644086d5ce1303b6a2271c697b4))


### Documentation

* **agents:** say what a fork does NOT inherit, because settings do not travel ([#24](https://github.com/Vadymk95/template-rn/issues/24)) ([91f0a55](https://github.com/Vadymk95/template-rn/commit/91f0a5575e46a0efc7843896ced5dd8922bc396c))
* **gate:** record why the push budget is not raised on today's window reading ([e1d4d48](https://github.com/Vadymk95/template-rn/commit/e1d4d484d6223908033da9919b40a784ffc7e22a))

## [0.2.0](https://github.com/Vadymk95/template-rn/compare/v0.1.0...v0.2.0) (2026-09-13)


### Features

* **docs-check:** focused tests never land; an unconditional skip carries a dated quarantine ([309618a](https://github.com/Vadymk95/template-rn/commit/309618aa1197c3f330594eacc21751e953b5c252))
* **gate:** docs:check in a docs class; the tracer records the phase ([1d0c6a3](https://github.com/Vadymk95/template-rn/commit/1d0c6a30c7d83fd2090c61225e7ea28b66fd7f87))
* **gate:** the browser suite has a ceiling in the tier data; push budgets are per phase ([b64a5cb](https://github.com/Vadymk95/template-rn/commit/b64a5cbad6145271e8a5c1080a0f0e0c9163045f))
* **start:** the first tab is the start guide; the Tasks demo moves to its own tab ([a96c4f3](https://github.com/Vadymk95/template-rn/commit/a96c4f39026f628268cdba603574a3972372912d))


### Bug fixes

* **docs-check:** relative markdown link targets are checked like backticked paths ([40937ac](https://github.com/Vadymk95/template-rn/commit/40937ac75b959f8307361f85d86e5c8dc4bbe4fc))


### Maintenance

* **deps:** in-range update; the 3-day cooldown lifted once by operator decision ([edf00af](https://github.com/Vadymk95/template-rn/commit/edf00af7f316c9db74dd2ae5d6192afc9fd91a48))


### CI

* **release:** release-please keeps a release PR with the version, changelog and tag ([f2887f3](https://github.com/Vadymk95/template-rn/commit/f2887f3be1990e0f3df0c7145455e5fca2fa6ecd))
