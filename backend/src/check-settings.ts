import 'dotenv/config';
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error('❌ Missing Turso Credentials');
    process.exit(1);
}

const client = createClient({
    url,
    authToken
});

async function checkSettings() {
    console.log('🔌 Connecting to Turso...');
    try {
        const result = await client.execute('SELECT * FROM Settings');
        console.log(`✅ Found ${result.rows.length} settings:`);
        console.table(result.rows);
    } catch (e: any) {
        console.error('❌ Database Error:', e.message);
    }
}

checkSettings();
