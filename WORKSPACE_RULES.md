# Workspace Rules & Best Practices

## Dependency Management
- **Single Root of Truth**: This project uses npm workspaces. All dependencies are hoisted to the root `node_modules`.
- **No Local node_modules**: Do NOT allow `node_modules` folders to be created inside `frontend/` or `backend/`.
- **Vite Configuration**:
  - In `frontend/vite.config.js`, you MUST set `cacheDir` to the root `node_modules`:
    ```javascript
    export default defineConfig({
        // ...
        cacheDir: '../node_modules/.vite', // CRITICAL: Prevents local node_modules creation
        // ...
    })
    ```
  - This prevents Vite from creating a duplicate `node_modules` folder for its cache.

## Build & Run
- Always run commands from the root when possible (e.g., `npm run dev`, `npm install`).
- Use `-w` flag for workspace-specific script execution (e.g., `npm run build -w frontend`).
