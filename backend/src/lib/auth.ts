import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const getSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("FATAL: JWT_SECRET environment variable is not defined.");
    }
    return secret;
};

const JWT_EXPIRES_IN = '7d';

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

export const hashPassword = async (password: string): Promise<string> => {
    return bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
};

export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, getSecret(), { expiresIn: JWT_EXPIRES_IN });
};

export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, getSecret()) as JWTPayload;
};
