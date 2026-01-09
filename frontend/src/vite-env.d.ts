/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string
    // More env variables can be added here as needed
    // readonly VITE_ANOTHER_VAR: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
