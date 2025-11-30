// utils/connectivity.ts
import NetInfo from '@react-native-community/netinfo';

// Global state
let isConnected = true;

// Listen to network changes
NetInfo.addEventListener(state => {
    isConnected = !!state.isConnected;
    console.log('Network changed:', isConnected ? 'ONLINE' : 'OFFLINE');
});

// Initial fetch with fallback
export const isOnline = async (): Promise<boolean> => {
    try {
        const state = await NetInfo.fetch();
        const connected = !!state.isConnected;
        isConnected = connected;
        return connected;
    } catch (err) {
        console.warn('NetInfo failed, using last known state:', isConnected);
        return isConnected; // fallback to last known state
    }
};

// Optional: expose current state
export const getCurrentOnlineStatus = () => isConnected;