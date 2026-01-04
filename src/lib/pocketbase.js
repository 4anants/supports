import PocketBase from 'pocketbase';

// Auto-detect URL: 
// 1. If running locally via Vite (npm run dev) -> Connect to 127.0.0.1:8090
// 2. If running "Production" (served by PocketBase) -> Connect to Relative URL '/'
const pbUrl = import.meta.env.VITE_POCKETBASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8090' : '/');

const pb = new PocketBase(pbUrl);

// Global auth store update handler (optional)
pb.authStore.onChange((token, model) => {
    // You can handle auth persistence or state updates here if needed
    // console.log('Auth Changed:', model);
});

// Disable Auto-Cancellation to allow multiple concurrent requests
pb.autoCancellation(false);

export default pb;
