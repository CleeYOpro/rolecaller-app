import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "rolecaller-app",
    slug: "rolecaller-app",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "rolecallerapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    extra: {
        DATABASE_URL: process.env.DATABASE_URL,
        eas: {
            projectId: "052e19fd-a1b0-458b-9541-fcc6ddc57cd0"
        }
    },
    ios: {
        supportsTablet: true
    },
    android: {
        adaptiveIcon: {
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
        output: "static"
    },
    plugins: [
        "expo-router",
        [
            "expo-splash-screen",
            {
                "imageWidth": 200,
                "resizeMode": "contain",
                "backgroundColor": "#ffffff",
                "dark": {
                    "backgroundColor": "#000000"
                }
            }
        ]
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: true
    }
});