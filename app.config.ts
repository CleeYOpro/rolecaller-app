import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "rolecaller",
    slug: "rolecaller",
    version: "1.3.3",
    orientation: "portrait",
    icon: "./assets/logo.png",
    scheme: "rolecallerapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    /* @info Added jsEngine configuration for Hermes */
    jsEngine: "hermes",
    /* @end */
    extra: {
        DATABASE_URL: process.env.DATABASE_URL,
        eas: {
            projectId: "6ab26f08-0cf3-4e63-be7e-25ea17169881"
        }
    },
    ios: {
        supportsTablet: true
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/logo.png",
            backgroundColor: "#E6F4FE"
        },
        splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        package: "com.cleo.schoolattendance"

    },
    web: {
        favicon: "./assets/logo.png",
        output: "static"
    },
    plugins: [
        "expo-router",
        [
            "expo-splash-screen",
            {
                "image": "./assets/splash.png",
                "imageWidth": 200,
                "resizeMode": "contain",
                "backgroundColor": "#ffffff",
                "dark": {
                    "backgroundColor": "#000000"
                }
            }
        ],
        [
            "expo-build-properties",
            {
                "android": {
                    "enableMinifyInReleaseBuilds": true,
                    "enableShrinkResourcesInReleaseBuilds": true
                }
            }
        ],
        "expo-sqlite"
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: true
    },
    /* @info Added development client configuration */
    developmentClient: {
        silentLaunch: true
    }
    /* @end */
});