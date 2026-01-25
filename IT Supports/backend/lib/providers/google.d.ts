import { CloudProvider } from './provider.interface';
export declare class GoogleDriveProvider implements CloudProvider {
    name: string;
    private clientId;
    private clientSecret;
    constructor(clientId: string, clientSecret: string);
    private getClient;
    getAuthUrl(redirectUri: string): string;
    connect(code: string, redirectUri: string): Promise<import("google-auth-library").Credentials>;
    refreshToken(): Promise<string>;
    uploadFile(filePath: string, fileName: string, folderName?: string): Promise<string>;
}
