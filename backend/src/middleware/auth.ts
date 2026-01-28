import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/auth';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        email: string;
        role: string;
    };
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        req.user = verifyToken(token);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
        if (req.user?.role !== 'Admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
};

export const requireSupport = (req: AuthRequest, res: Response, next: NextFunction) => {
    requireAuth(req, res, () => {
        if (req.user?.role !== 'Admin' && req.user?.role !== 'IT Support') {
            return res.status(403).json({ error: 'Access denied: Requires Admin or IT Support role' });
        }
        next();
    });
};
