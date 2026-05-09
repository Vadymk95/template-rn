module.exports = function (api) {
    api.cache(true);

    return {
        presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
        // `react-native-worklets/plugin` MUST be the LAST plugin (Reanimated 4
        // contract — worklets run after every other transform). Earlier ordering
        // put it first and appended `transform-remove-console` after it in
        // production, breaking the contract silently. transform-remove-console
        // is now placed BEFORE worklets so dead `console.*` is stripped before
        // worklets pick over the AST.
        plugins: [
            ...(process.env.NODE_ENV === 'production'
                ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
                : []),
            'react-native-worklets/plugin'
        ]
    };
};
