import 'isomorphic-fetch';
import { CloudProvider } from './provider.interface';
export declare class OneDriveProvider implements CloudProvider {
    name: string;
    private clientId;
    private clientSecret;
    constructor(clientId: string, clientSecret: string);
    getAuthUrl(redirectUri: string): string;
    connect(code: string, redirectUri: string): Promise<any>;
    refreshToken(): Promise<string>;
    uploadFile(filePath: string, fileName: string, folderName?: string): Promise<string>;
}
