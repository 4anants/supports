"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireAuth = void 0;
const auth_1 = require("../lib/auth");
const requireAuth = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];
        req.user = (0, auth_1.verifyToken)(token);
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.requireAuth = requireAuth;
const requireAdmin = (req, res, next) => {
    (0, exports.requireAuth)(req, res, () => {
        if (req.user?.role !== 'Admin' && req.user?.role !== 'IT Support') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map