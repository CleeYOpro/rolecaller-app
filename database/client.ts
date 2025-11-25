import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as schema from './schema';

// Polyfill for TextEncoder/Decoder if needed (for Neon in RN)
if (Platform.OS !== 'web') {
    if (typeof global.TextEncoder === 'undefined') {
        const { TextEncoder, TextDecoder } = require('text-encoding');
        global.TextEncoder = TextEncoder;
        global.TextDecoder = TextDecoder;
    }
}

const getConnectionString = () => {
    // Check process.env for Node.js (scripts)
    if (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    // Check Expo Constants for App
    if (Constants.expoConfig?.extra?.DATABASE_URL) {
        return Constants.expoConfig.extra.DATABASE_URL;
    }
    // Fallback or throw
    return '';
};

const connectionString = getConnectionString();

if (!connectionString) {
    console.warn('DATABASE_URL is not defined in process.env or app.json extra');
}

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
