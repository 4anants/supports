"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ALGORITHM = 'aes-256-cbc';
// Use a fixed key from ENV or a consistent fallback for this local app (less secure but functional for single-tenant local)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
    ? crypto_1.default.createHash('sha256').update(String(process.env.ENCRYPTION_KEY)).digest('base64').substr(0, 32)
    : crypto_1.default.createHash('sha256').update('fallback-secret-key-CHANGE-ME').digest('base64').substr(0, 32);
const IV_LENGTH = 16;
const encrypt = (text) => {
    if (!text)
        return '';
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};
exports.encrypt = encrypt;
const decrypt = (text) => {
    if (!text)
        return '';
    try {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
    catch (e) {
        // Fallback for non-encrypted legacy tokens
        return text;
    }
};
exports.decrypt = decrypt;
//# sourceMappingURL=crypto.js.map