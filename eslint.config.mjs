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

const boundariesElements = [
    { type: 'app', pattern: 'src/app/**/*.{ts,tsx}', mode: 'full' },
    { type: 'widgets', pattern: 'src/widgets/**/*.{ts,tsx}', mode: 'full' },
    {
        type: 'features',
        pattern: ['src/features/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}'],
        mode: 'full'
    },
    { type: 'entities', pattern: 'src/store/**/*.{ts,tsx}', mode: 'full' },
    {
        type: 'shared',
        pattern: ['src/lib/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}', 'src/env.ts'],
        mode: 'full'
    }
];

const fsdDependencyRules = [
    {
        allow: {
            dependency: {
                relationship: { to: ['internal', 'sibling', 'child', 'descendant'] }
            }
        }
    },
    {
        from: { type: 'app' },
        disallow: { to: { type: 'entities' } },
        message:
            'FSD: Expo Router files must not import entities (stores) directly. Use @/widgets/... or @/features/... public API.'
    },
    {
        from: { type: 'widgets' },
        disallow: { to: { type: ['app', 'entities'] } },
        message:
            'FSD: Widgets compose features; they must not import app routes or entity stores. Go through @/features/...'
    },
    {
        from: { type: 'features' },
        disallow: { to: { type: ['app', 'widgets'] } },
        message: 'FSD: Features must not import upward (app or widgets).'
    },
    {
        from: { type: 'entities' },
        disallow: { to: { type: ['app', 'widgets', 'features'] } },
        message: 'FSD: Entity layer must not import app, widgets, or features.'
    },
    {
        from: { type: 'shared' },
        disallow: { to: { type: ['app', 'widgets', 'features', 'entities'] } },
        message: 'FSD: shared (lib/env) must not import product layers.'
    }
];

export default tseslint.config(
    {
        ignores: [
            '**/node_modules/**',
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
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/no-import-type-side-effects': 'error',
            '@typescript-eslint/switch-exhaustiveness-check': 'error',
            '@typescript-eslint/no-unnecessary-type-parameters': 'error',
            '@typescript-eslint/prefer-nullish-coalescing': [
                'error',
                { ignorePrimitives: { string: true } }
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
                    message: '{{from.type}} is not allowed to depend on {{to.type}}',
                    rules: fsdDependencyRules
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
    {
        files: ['**/*.{test,spec}.{ts,tsx}', 'src/test/**/*.ts'],
        ...tseslint.configs.disableTypeChecked,
        ...jestPlugin.configs['flat/recommended'],
        rules: {
            ...jestPlugin.configs['flat/recommended'].rules,
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
            '@typescript-eslint/no-require-imports': 'off'
        }
    }
);
