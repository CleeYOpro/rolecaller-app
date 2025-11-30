# Hermes Debugging Troubleshooting Guide

## Issue
You're seeing the error: "No compatible apps connected. React Native DevTools can only be used with Hermes."

## Diagnosis
Even though we've configured Hermes in your app.config.ts, there might be several reasons why the debugger isn't detecting Hermes:

## Solutions

### 1. Verify Hermes is Enabled
First, double-check that Hermes is actually enabled in your app:

In `app.config.ts`, you should have:
```ts
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  // ... other config
  jsEngine: "hermes", // This line is crucial
  // ... rest of config
});
```

### 2. Ensure You're Running a Development Build
Hermes debugging only works with development builds, not production builds.

Start your app with:
```bash
npx expo start
```

Then press `a` for Android or `i` for iOS to run on a simulator/device.

### 3. Check Connection to Development Server
The debugging feature requires a WebSocket connection between your app and the development server.

Try these steps:
1. Make sure your device/emulator can reach the development server
2. Try reloading the app by pressing `r` in the Expo CLI terminal
3. Check if the Metro bundler is running on port 8081:
   ```bash
   # On Mac/Linux
   lsof -ti:8081
   
   # On Windows
   netstat -ano | findstr :8081
   ```

### 4. Test Debugging Availability
Run this command to check if the debugging endpoint is available:
```bash
curl http://localhost:8081/json/list
```

You should see a JSON response with Hermes-related entries.

### 5. If Using EAS Build
If you're using a build created with EAS Build, make sure it's a development build:
```bash
eas build --profile development
```

Production builds don't include the debugging capabilities.

### 6. Clear Cache and Restart
Sometimes clearing the cache helps:
```bash
npx expo start --clear
```

### 7. Platform-Specific Considerations
For iOS, you might need to ensure you're not using JSC:
```ts
{
  expo: {
    jsEngine: "hermes", // Default for all platforms
    ios: {
      // Don't override jsEngine here unless you specifically want JSC
    }
  }
}
```

## Additional Notes
- Hermes is the default engine since Expo SDK 46, but explicitly setting it ensures consistency
- Remote debugging (the legacy debugging method) doesn't work well with Hermes and modern React Native features
- Make sure you're using the React Native DevTools rather than the legacy Remote JS Debugger