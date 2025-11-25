import Constants from 'expo-constants';
import { Client } from 'pg';

const client = new Client({
  connectionString: Constants.manifest.extra.NEON_URL, // store your Neon URL in app config or .env
});

export const connect = async () => {
  try {
    await client.connect();
    console.log('Connected to Neon!');
  } catch (err) {
    console.log('Neon connection error:', err);
  }
};

export default client;
