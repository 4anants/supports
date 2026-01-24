import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
export declare const verifyPin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>>>;
