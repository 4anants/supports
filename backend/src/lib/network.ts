import { execSync } from 'child_process';

/**
 * Authenticates a network path (UNC) on Windows using 'net use'.
 * This allows the Node.js process to access restricted shares.
 */
export const authenticateNetworkPath = (networkPath: string, user?: string, pass?: string): boolean => {
    // Only applies to Windows UNC paths
    if (process.platform !== 'win32' || !networkPath.startsWith('\\\\')) {
        return false;
    }

    if (!user || !pass) {
        return false;
    }

    try {
        // 1. Try to remove any existing conflicting connections to this specific path
        try {
            execSync(`net use "${networkPath}" /delete /y`, { stdio: 'ignore' });
        } catch (e) {
            // Ignore if no connection exists
        }

        // 2. Establish new connection
        // /PERSISTENT:NO ensures it doesn't stay after reboot
        execSync(`net use "${networkPath}" "${pass}" /user:"${user}" /PERSISTENT:NO`, {
            stdio: 'ignore',
            timeout: 5000 // 5 second timeout for network ops
        });

        console.log(`[Network] Authenticated successfully: ${networkPath}`);
        return true;
    } catch (err: any) {
        console.error(`[Network] Authentication failed for ${networkPath}:`, err.message);
        throw new Error(`Network Authentication Failed: Ensure the path and credentials are correct.`);
    }
};
