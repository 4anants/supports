import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from './auth';
import { comparePassword } from '../lib/auth';

export const verifyPin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const pinSetting = await prisma.settings.findUnique({ where: { key: 'security_pin' } });
        // Only require PIN if it is set in settings
        if (pinSetting && pinSetting.value) {
            const providedPin = req.headers['x-security-pin'];
            if (!providedPin || typeof providedPin !== 'string') {
                return res.status(403).json({ error: 'Invalid Security PIN' });
            }

            const isMatch = await comparePassword(providedPin, pinSetting.value);
            if (!isMatch) {
                return res.status(403).json({ error: 'Invalid Security PIN' });
            }
        }
        next();
    } catch (error) {
        console.error('PIN Verification Error:', error);
        res.status(500).json({ error: 'Security check failed' });
    }
};
