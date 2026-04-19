export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'header-max-length': [2, 'always', 96],
        'type-enum': [
            2,
            'always',
            [
                'feat',
                'fix',
                'chore',
                'docs',
                'style',
                'refactor',
                'perf',
                'test',
                'revert',
                'build',
                'ci'
            ]
        ]
    }
};
