export interface CloudProvider {
    name: string;
    connect(code: string, redirectUri: string): Promise<any>;
    refreshToken(): Promise<string>;
    uploadFile(filePath: string, fileName: string, folderName?: string): Promise<string>;
    getAuthUrl(redirectUri: string): string;
}
