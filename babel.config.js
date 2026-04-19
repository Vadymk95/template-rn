module.exports = function (api) {
    api.cache(true);

    return {
        presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
        plugins: [
            // Must be last — Reanimated 4 ships its worklets plugin separately.
            'react-native-worklets/plugin',
            ...(process.env.NODE_ENV === 'production'
                ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
                : [])
        ]
    };
};
