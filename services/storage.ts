import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
    SCHOOL_ID: 'rolecaller_school_id',
    SCHOOL_NAME: 'rolecaller_school_name',
    LAST_SYNC: 'rolecaller_last_sync',
};

export const storage = {
    saveSchool: async (id: string, name: string) => {
        try {
            await AsyncStorage.setItem(KEYS.SCHOOL_ID, id);
            await AsyncStorage.setItem(KEYS.SCHOOL_NAME, name);
        } catch (e) {
            console.error('Failed to save school to storage', e);
        }
    },

    getSchool: async () => {
        try {
            const id = await AsyncStorage.getItem(KEYS.SCHOOL_ID);
            const name = await AsyncStorage.getItem(KEYS.SCHOOL_NAME);
            if (id && name) return { id, name };
            return null;
        } catch (e) {
            console.error('Failed to get school from storage', e);
            return null;
        }
    },

    clearSchool: async () => {
        try {
            await AsyncStorage.removeItem(KEYS.SCHOOL_ID);
            await AsyncStorage.removeItem(KEYS.SCHOOL_NAME);
        } catch (e) {
            console.error('Failed to clear school from storage', e);
        }
    },

    saveLastSync: async () => {
        await AsyncStorage.setItem(KEYS.LAST_SYNC, new Date().toISOString());
    },

    getLastSync: async () => {
        return await AsyncStorage.getItem(KEYS.LAST_SYNC);
    }
};
