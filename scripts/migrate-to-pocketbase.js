import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import PocketBase from 'pocketbase';
import 'dotenv/config';

// ------------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------------

// 1. Firebase Configuration (Matches src/lib/firebase.js)
const firebaseConfig = {
    apiKey: "AIzaSyBkSaNX5gYffkoxP345hSDlUtKyhnc0teA",
    authDomain: "ae-supports.firebaseapp.com",
    projectId: "ae-supports",
    storageBucket: "ae-supports.firebasestorage.app",
    messagingSenderId: "859881201906",
    appId: "1:859881201906:web:f4fda28db23ae5a883f06b"
};

// 2. PocketBase Configuration
const PB_URL = process.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_ADMIN_PASS = process.env.PB_ADMIN_PASS;

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASS) {
    console.error("❌ Error: Please set PB_ADMIN_EMAIL and PB_ADMIN_PASS in .env or environment variables.");
    process.exit(1);
}

// ------------------------------------------------------------------
// INITIALIZATION
// ------------------------------------------------------------------

console.log(`Connecting to Firebase...`);
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

console.log(`Connecting to PocketBase at ${PB_URL}...`);
const pb = new PocketBase(PB_URL);

// ------------------------------------------------------------------
// MIGRATION LOGIC
// ------------------------------------------------------------------

async function migrate() {
    try {
        // Authenticate as Admin
        await pb.admins.authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASS);
        console.log("✅ Authenticated with PocketBase Admin.");

        // --- Migrate Settings ---
        console.log("\n📦 Migrating Settings...");
        const settingsSnap = await getDocs(collection(db, "settings"));
        for (const doc of settingsSnap.docs) {
            const data = doc.data();
            // In Firebase, settings might be { value: '...' } with docId as key.
            // Or a collection of kv pairs. 
            // Based on TicketSubmissions.jsx: doc.id is key, doc.data().value is value.

            const key = doc.id;
            const value = data.value;

            try {
                // Check if exists
                // Note: You might need to create a 'settings' collection in PB first with 'key' and 'value' fields.
                await pb.collection('settings').create({ key, value });
                console.log(`   + Migrated setting: ${key}`);
            } catch (e) {
                console.log(`   - Failed/Skipped setting ${key}: ${e.message}`);
            }
        }

        // --- Migrate Offices ---
        console.log("\n🏢 Migrating Offices...");
        const officesSnap = await getDocs(collection(db, "offices"));
        for (const doc of officesSnap.docs) {
            const data = doc.data();
            try {
                await pb.collection('offices').create({ ...data, firebase_id: doc.id });
                console.log(`   + Office: ${data.name}`);
            } catch (e) {
                console.error(`   - Error office ${doc.id}: ${e.message}`);
            }
        }

        // --- Migrate Departments ---
        console.log("\n👥 Migrating Departments...");
        const deptsSnap = await getDocs(collection(db, "departments"));
        for (const doc of deptsSnap.docs) {
            const data = doc.data();
            try {
                await pb.collection('departments').create({ ...data, firebase_id: doc.id });
                console.log(`   + Dept: ${data.name}`);
            } catch (e) {
                console.error(`   - Error dept ${doc.id}: ${e.message}`);
            }
        }

        // --- Migrate Tickets ---
        console.log("\n🎫 Migrating Tickets...");
        const ticketsSnap = await getDocs(collection(db, "tickets"));
        for (const doc of ticketsSnap.docs) {
            const data = doc.data();
            try {
                // PocketBase doesn't allow arbitrary fields. Make sure 'tickets' collection exists 
                // and has fields matching these keys.
                await pb.collection('tickets').create({
                    ...data,
                    firebase_id: doc.id,
                    // Ensure dates are formatted if needed, PB uses standard strings.
                });
                console.log(`   + Ticket: ${data.generated_id || doc.id}`);
            } catch (e) {
                console.error(`   - Error ticket ${doc.id}: ${e.message}`);
            }
        }

        console.log("\n✅ Migration Complete!");

    } catch (err) {
        console.error("❌ Fatal Error during migration:", err);
    }
}

migrate();
