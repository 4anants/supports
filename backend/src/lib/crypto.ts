
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ALGORITHM = 'aes-256-cbc';
// Use a fixed key from ENV or a consistent fallback for this local app (less secure but functional for single-tenant local)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? crypto.createHash('sha256').update(String(process.env.ENCRYPTION_KEY)).digest('base64').substr(0, 32)
    : crypto.createHash('sha256').update('fallback-secret-key-CHANGE-ME').digest('base64').substr(0, 32);

const IV_LENGTH = 16;

export const encrypt = (text: string): string => {
    if (!text) return '';
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decrypt = (text: string): string => {
    if (!text) return '';
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // Fallback for non-encrypted legacy tokens
        return text;
    }
};
