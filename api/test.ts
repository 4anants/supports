import type { Request, Response } from 'express';

export default function handler(req: Request, res: Response) {
    try {
        // Simple diagnostic response
        res.status(200).json({
            status: 'ok',
            message: 'Vercel function is working',
            timestamp: new Date().toISOString(),
            env: {
                hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
                hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
                hasJwtSecret: !!process.env.JWT_SECRET
            }
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
}
