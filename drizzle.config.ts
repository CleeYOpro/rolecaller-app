import * as dotenv from 'dotenv';
import type { Config } from 'drizzle-kit';
dotenv.config();

export default {
    schema: './database/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
} satisfies Config;
