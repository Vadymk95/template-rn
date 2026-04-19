import type { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env['APP_VARIANT'] === 'development';
const IS_PREVIEW = process.env['APP_VARIANT'] === 'preview';

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
            ITSAppUsesNonExemptEncryption: false,
            NSCameraUsageDescription: 'Allow $(PRODUCT_NAME) to access the camera.',
            NSLocationWhenInUseUsageDescription:
                'Allow $(PRODUCT_NAME) to access your location while the app is in use.',
            NSPhotoLibraryUsageDescription: 'Allow $(PRODUCT_NAME) to access your photo library.'
        }
    },
    android: {
        adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#ffffff'
        },
        package: getBundleId(),
        permissions: ['CAMERA', 'ACCESS_FINE_LOCATION', 'READ_MEDIA_IMAGES']
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
        eas: {
            projectId: 'YOUR_EAS_PROJECT_ID'
        }
    },
    updates: {
        url: 'https://u.expo.dev/YOUR_EAS_PROJECT_ID'
    },
    runtimeVersion: {
        policy: 'appVersion'
    }
});
