export declare const BACKUP_DIR: string;
export declare const UPLOADS_DIR: string;
export declare const performBackup: (externalPath?: string) => Promise<{
    success: boolean;
    log: string[];
    location: string;
    error?: undefined;
} | {
    success: boolean;
    log: string[];
    error: any;
    location?: undefined;
}>;
export declare const scheduleBackups: () => Promise<void>;
