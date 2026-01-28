import path from 'path';
import fs from 'fs';

// This file centralizes all filesystem paths used by the backend.
// Paths are relative to the compiled server location or dev source location.

const isProduction = process.env.NODE_ENV === 'production';

// ROOT_DIR: e:\Supports
// In Dev: backend/src/lib/paths.ts -> ../../.. -> Supports
// In Prod: backend/dist/lib/paths.js -> ../../.. -> Supports (staging root)
export const ROOT_DIR = path.join(__dirname, '../../../');

export const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
export const BACKUP_DIR = path.join(ROOT_DIR, 'backups');
export const PRISMA_DIR = path.join(ROOT_DIR, 'prisma');

// Database Paths
const DB_PATH_PROD = path.join(PRISMA_DIR, 'prod.db');
const DB_PATH_DEV = path.join(PRISMA_DIR, 'dev.db');
const DB_PATH_ROOT = path.join(ROOT_DIR, 'dev.db');

export const DB_PATH = fs.existsSync(DB_PATH_PROD)
    ? DB_PATH_PROD
    : (fs.existsSync(DB_PATH_ROOT) ? DB_PATH_ROOT : DB_PATH_DEV);

// Ensure essential directories exist
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
