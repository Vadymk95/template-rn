const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
const upstreamResolveRequest = config.resolver.resolveRequest;

// Work around expo-router -> expo-symbols pulling unused Material Symbols TTFs
// into Android exports until the upstream dependency becomes optional/lazy.
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (
        platform === 'android' &&
        (moduleName.includes('@expo-google-fonts/material-symbols') ||
            moduleName.includes('MaterialSymbols_'))
    ) {
        return { type: 'empty' };
    }

    if (typeof upstreamResolveRequest === 'function') {
        return upstreamResolveRequest(context, moduleName, platform);
    }

    return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
