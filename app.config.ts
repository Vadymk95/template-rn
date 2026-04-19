import type { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env['APP_VARIANT'] === 'development';
const IS_PREVIEW = process.env['APP_VARIANT'] === 'preview';

/** Set by EAS Build/Update or `eas.json` env when using OTA; omit for local-only dev. */
// eslint-disable-next-line expo/no-dynamic-env-var -- EAS injects at build; not a client bundle key
const easProjectId = process.env['EAS_PROJECT_ID'];

const getBundleId = () => {
    if (IS_DEV) return 'com.example.templatern.dev';
    if (IS_PREVIEW) return 'com.example.templatern.preview';
    return 'com.example.templatern';
};

const getAppName = () => {
    if (IS_DEV) return 'Template RN (Dev)';
    if (IS_PREVIEW) return 'Template RN (Preview)';
    return 'Template RN';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: getAppName(),
    slug: 'template-rn',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'templatern',
    userInterfaceStyle: 'automatic',
    splash: {
        image: './assets/splash.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff'
    },
    ios: {
        supportsTablet: true,
        bundleIdentifier: getBundleId(),
        infoPlist: {
            ITSAppUsesNonExemptEncryption: false
        },
        privacyManifests: {
            NSPrivacyAccessedAPITypes: [
                {
                    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
                    NSPrivacyAccessedAPITypeReasons: ['C617.1']
                },
                {
                    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
                    NSPrivacyAccessedAPITypeReasons: ['CA92.1']
                },
                {
                    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
                    NSPrivacyAccessedAPITypeReasons: ['35F9.1']
                },
                {
                    NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
                    NSPrivacyAccessedAPITypeReasons: ['E174.1']
                }
            ]
        }
    },
    android: {
        adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#ffffff'
        },
        package: getBundleId(),
        permissions: []
    },
    plugins: [
        'expo-router',
        'expo-font',
        'expo-secure-store',
        'expo-localization',
        [
            'expo-splash-screen',
            {
                image: './assets/splash.png',
                resizeMode: 'contain',
                backgroundColor: '#ffffff'
            }
        ]
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: true
    },
    extra: {
        router: { origin: false },
        ...(easProjectId ? { eas: { projectId: easProjectId } } : {})
    },
    ...(easProjectId
        ? {
              updates: {
                  url: `https://u.expo.dev/${easProjectId}`
              }
          }
        : {}),
    runtimeVersion: {
        policy: 'appVersion'
    }
});
