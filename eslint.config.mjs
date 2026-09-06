import js from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import expoConfig from 'eslint-config-expo/flat.js';
import boundaries from 'eslint-plugin-boundaries';
import i18nextPlugin from 'eslint-plugin-i18next';
import importX from 'eslint-plugin-import-x';
import jestPlugin from 'eslint-plugin-jest';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import reactCompiler from 'eslint-plugin-react-compiler';
import templatePlugin from './tooling/eslint-plugin-template/index.mjs';
import tseslint from 'typescript-eslint';

// v7: element descriptors are FOLDER-scoped (patterns without file extensions;
// partialMatch: false anchors them at the project root). src/env.ts cannot be
// an element in v7 (single files are not classifiable) — acceptable gap: its
// only import is zod, so the shared-layer policy has nothing to guard there.
const boundariesElements = [
    { type: 'app', pattern: 'src/app', partialMatch: false },
    { type: 'widgets', pattern: 'src/widgets', partialMatch: false },
    { type: 'features', pattern: ['src/features', 'src/hooks'], partialMatch: false },
    { type: 'entities', pattern: 'src/store', partialMatch: false },
    { type: 'shared', pattern: ['src/lib', 'src/shared'], partialMatch: false }
];

// v7 object-based selectors: element selectors are wrapped in `element`.
const fsdDependencyPolicies = [
    {
        allow: {
            dependency: {
                relationship: { to: ['internal', 'sibling', 'child', 'descendant'] }
            }
        }
    },
    {
        from: { element: { type: 'app' } },
        disallow: { to: { element: { type: 'entities' } } },
        message:
            'FSD: Expo Router files must not import entities (stores) directly. Use @/widgets/... or @/features/... public API.'
    },
    {
        from: { element: { type: 'widgets' } },
        disallow: { to: { element: { type: ['app', 'entities'] } } },
        message:
            'FSD: Widgets compose features; they must not import app routes or entity stores. Go through @/features/...'
    },
    {
        from: { element: { type: 'features' } },
        disallow: { to: { element: { type: ['app', 'widgets'] } } },
        message: 'FSD: Features must not import upward (app or widgets).'
    },
    {
        from: { element: { type: 'entities' } },
        disallow: { to: { element: { type: ['app', 'widgets', 'features'] } } },
        message: 'FSD: Entity layer must not import app, widgets, or features.'
    },
    {
        from: { element: { type: 'shared' } },
        disallow: { to: { element: { type: ['app', 'widgets', 'features', 'entities'] } } },
        message: 'FSD: shared (lib/env) must not import product layers.'
    }
];

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
            // A crashed Stryker run leaves its sandbox behind; the gate must never lint a copy of the repo.
            '.stryker-tmp/**',
            '.expo/**',
            'dist/**',
            'ios/**',
            'android/**',
            'coverage/**'
        ]
    },
    js.configs.recommended,
    ...expoConfig,
    {
        rules: {
            'import/no-unresolved': 'off',
            'import/namespace': 'off',
            'import/no-duplicates': 'off',
            'import/default': 'off',
            'import/no-named-as-default-member': 'off',
            'import/no-named-as-default': 'off'
        }
    },
    {
        ...pluginQuery.configs['flat/recommended-strict'][0],
        files: ['src/**/*.{ts,tsx}']
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        settings: {
            'import-x/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json'
                }
            },
            'import/resolver': {
                typescript: {
                    alwaysTryTypes: true,
                    project: './tsconfig.json'
                }
            },
            'boundaries/elements': boundariesElements,
            'boundaries/ignore': ['**/*.{test,spec}.{ts,tsx}', 'src/test/**']
        },
        plugins: {
            'import-x': importX,
            boundaries,
            prettier: prettierPlugin,
            'react-compiler': reactCompiler,
            template: templatePlugin
        },
        rules: {
            ...prettierConfig.rules,
            'prettier/prettier': 'error',
            'no-console': 'error',
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                './*',
                                '../*',
                                '../../*',
                                '../../../*',
                                '../../../../*',
                                '../../../../../*'
                            ],
                            message: 'Use the `@/` alias for imports inside `src/**`.'
                        }
                    ]
                }
            ],
            '@typescript-eslint/consistent-type-imports': [
                'error',
                { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
            ],
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
            ],
            // ─── Explicit in/out contracts ───────────────────────────────────
            // Every named function declares its output: either a variable type
            // annotation (const X: FunctionComponent<Props> = () => …) or an
            // explicit return type (const Screen = (): ReactElement => …).
            // Inline callbacks passed as arguments/JSX props stay free
            // (allowExpressions). Inputs are covered by TS strict itself:
            // noImplicitAny forces every props/param type to be declared.
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                    allowHigherOrderFunctions: true,
                    allowIIFEs: true
                }
            ],
            // Property-style signatures (`onSelect: (id: string) => void`) get
            // strict contravariant parameter checks; method style (`onSelect(id)`)
            // is checked bivariantly — looser, can hide unsound narrowing.
            '@typescript-eslint/method-signature-style': ['error', 'property'],
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/no-unnecessary-type-parameters': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': [
                'error',
                { ignorePrimitives: { string: true } }
            ],
            // ─── No bare numeric literals in logic ───────────────────────────
            // A number with no name cannot be searched for, and the same number
            // in two places drifts silently. The ignore list is the set that is
            // self-explanatory in context: identity/empty/pair, percent and
            // millisecond bases. Everything else gets a named constant — see
            // .cursor/rules/constants.mdc for where it belongs.
            // Token tables and config files are exempt below: there the number
            // IS the definition, and naming it would just add indirection.
            '@typescript-eslint/no-magic-numbers': [
                'error',
                {
                    ignore: [-1, 0, 1, 2, 100, 1000],
                    ignoreEnums: true,
                    ignoreReadonlyClassProperties: true,
                    ignoreArrayIndexes: true,
                    ignoreDefaultValues: true,
                    ignoreTypeIndexes: true
                }
            ],
            'import-x/order': [
                'error',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true }
                }
            ],
            'import-x/no-cycle': 'error',
            'import-x/no-default-export': 'off',
            'react-compiler/react-compiler': 'error',
            'boundaries/dependencies': [
                'error',
                {
                    default: 'allow',
                    message:
                        '{{from.element.types.[0]}} is not allowed to depend on {{to.element.types.[0]}}',
                    policies: fsdDependencyPolicies
                }
            ]
        }
    },
    {
        files: ['src/lib/logger.ts'],
        rules: {
            'no-console': ['warn', { allow: ['log', 'warn', 'error'] }]
        }
    },
    // ─── No raw hex colours outside the token tables ────────────────────────
    // Colours have exactly two homes: the NativeWind theme in `global.css`
    // (consumed as `className`) and `COLOR_VALUES` in
    // src/shared/lib/theme/colors.ts for the places that need a real value
    // (navigation options, Reanimated, native props). A literal anywhere else
    // drifts from both — this rule exists because `TAB_BAR_ACTIVE_TINT` had
    // already drifted to `#0a0a0a` while the token said `#09090B`.
    // Both selectors are needed: a plain string and a template literal are
    // different AST nodes.
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/shared/lib/theme/**', '**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'Literal[value=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
                    message:
                        'No raw hex colours outside src/shared/lib/theme — use a token from COLOR_VALUES or a NativeWind class.'
                },
                {
                    selector:
                        'TemplateElement[value.raw=/#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b/]',
                    message:
                        'No raw hex colours outside src/shared/lib/theme — use a token from COLOR_VALUES or a NativeWind class.'
                }
            ]
        }
    },
    // ─── Token tables define the numbers; naming them would be indirection ──
    // src/shared/lib/theme/** is the design vocabulary (radii, spacing, type
    // scale, control sizes, colour values). A magic-number rule there would
    // demand a constant for the constant.
    {
        files: ['src/shared/lib/theme/**/*.ts'],
        rules: {
            '@typescript-eslint/no-magic-numbers': 'off'
        }
    },
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['src/env.ts', 'src/lib/logger.ts', '**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
        plugins: {
            template: templatePlugin
        },
        rules: {
            'template/no-process-env-outside-env': 'error'
        }
    },
    {
        files: [
            'src/app/**/*.{ts,tsx}',
            'src/widgets/**/*.{ts,tsx}',
            'src/features/**/*.{ts,tsx}',
            'src/shared/ui/**/*.{ts,tsx}'
        ],
        ignores: ['**/*.{test,spec}.{ts,tsx}'],
        plugins: {
            i18next: i18nextPlugin,
            template: templatePlugin
        },
        rules: {
            'i18next/no-literal-string': [
                'error',
                {
                    framework: 'react',
                    mode: 'jsx-text-only',
                    words: {
                        exclude: ['^\\s*$', '^[0-9]+$', '^[/.:?#=&_-]+$']
                    }
                }
            ],
            'template/no-user-copy-literals': 'error'
        }
    },
    {
        files: ['src/app/**/*.{ts,tsx}'],
        rules: {
            'import-x/no-default-export': 'off',
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowExpressions: true,
                    allowTypedFunctionExpressions: true,
                    allowHigherOrderFunctions: true,
                    allowDirectConstAssertionInArrowFunctions: true
                }
            ]
        }
    },
    {
        files: ['src/app/_layout.tsx'],
        rules: {
            'no-restricted-imports': 'off'
        }
    },
    // ─── TanStack Query option factories — inference is the API design ───────
    // queryOptions() derives queryKey/queryFn types from the options object;
    // spelling out its return type would be brittle noise. The options object
    // itself is the declared contract.
    {
        files: ['src/lib/api/**/*Query.ts', 'src/lib/api/**/*.queries.ts'],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off'
        }
    },
    {
        files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.ts'],
        ...tseslint.configs.disableTypeChecked,
        ...jestPlugin.configs['flat/recommended'],
        rules: {
            ...jestPlugin.configs['flat/recommended'].rules,
            // Test helpers/fixtures don't need declared return contracts.
            '@typescript-eslint/explicit-function-return-type': 'off',
            // A test asserting a constant must spell the value out. Importing the
            // constant it checks would make the assertion tautological — change the
            // constant and the test follows it silently. Literal fixtures are the
            // point here, so the rule is off rather than worked around.
            '@typescript-eslint/no-magic-numbers': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/unbound-method': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
            'no-console': 'off'
        }
    },
    {
        files: [
            'app.config.ts',
            '*.config.{js,ts,mjs,cjs}',
            'babel.config.js',
            'metro.config.js',
            'tailwind.config.js',
            'eslint.config.mjs',
            'commitlint.config.mjs'
        ],
        ...tseslint.configs.disableTypeChecked,
        plugins: { prettier: prettierPlugin },
        rules: {
            ...prettierConfig.rules,
            'prettier/prettier': 'error',
            'import-x/no-default-export': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            // Build/native config: the numbers and colours there ARE the values
            // (ports, versions, splash background), with nothing to reference.
            '@typescript-eslint/no-magic-numbers': 'off',
            'no-restricted-syntax': 'off'
        }
    },
    /*
     * Complexity ratchet — thresholds sit ABOVE the measured ceiling, so the tree is
     * clean today and only future drift can trip them. Measured 2026-08-09 over
     * src/** excluding tests (ESLint API probe with every rule at warn-zero):
     *   complexity              max 20  (shared/ui/Button/Button.tsx:72 — outlier, see below; next is 13, p95 is 5)
     *   max-depth               max 2
     *   max-params              max 3
     *   max-lines-per-function  max 92  (worst: shared/ui/Button/Button.tsx)
     *   max-lines               max 142 (worst: shared/ui/Button/Button.tsx)
     * Tests and src/test/ are exempt on purpose: a describe block is one function and
     * table-driven suites are long by design, so these rules there would only teach
     * people to split tests for the linter's sake. When a threshold fires, the first
     * answer is to split the function, not to raise the number; raising it needs a
     * fresh measurement and a DECISIONS.md line ("Complexity ratchet" entry).
     */
    {
        files: ['src/**/*.{ts,tsx}'],
        ignores: ['**/*.test.*', 'src/test/**'],
        rules: {
            complexity: ['error', 15],
            'max-depth': ['error', 3],
            'max-params': ['error', 4],
            'max-lines-per-function': [
                'error',
                { max: 120, skipBlankLines: true, skipComments: true }
            ],
            'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }]
        }
    },
    /*
     * Documented file-scoped exception, per the zero-warnings contract in AGENTS.md.
     * Button's single variant-resolver arrow measures complexity 20: one conditional
     * per variant/size/state combination in the NativeWind class map — the shadcn-style
     * pattern this kit ships, where every branch is a flat, readable lookup line, not
     * nesting (max-depth in that file is 1). Splitting it would scatter one variant
     * table across helpers and make the kit HARDER to copy from. The ceiling is pinned
     * at its measured value so the exception cannot quietly absorb new growth: one more
     * branch fires the rule, and that is the moment to split the table instead.
     */
    {
        files: ['src/shared/ui/Button/Button.tsx'],
        rules: {
            complexity: ['error', 20]
        }
    },
    // ─── React version must be a LITERAL, never 'detect' ────────────────────
    // eslint-config-expo sets `settings.react.version: 'detect'`. Under ESLint 10
    // the detection path in eslint-plugin-react calls the removed
    // `context.getFilename()` and every React rule throws instead of linting —
    // the gate goes red for a reason that has nothing to do with the code.
    // This block carries no `files` key so it applies to every file and, being
    // last, wins over the Expo preset. Keep it in step with `react` in
    // package.json.
    {
        settings: {
            react: { version: '19.2' }
        }
    }
);
