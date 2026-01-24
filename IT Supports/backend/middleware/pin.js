"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPin = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_1 = require("../lib/auth");
const verifyPin = async (req, res, next) => {
    try {
        const pinSetting = await prisma_1.default.settings.findUnique({ where: { key: 'security_pin' } });
        // Only require PIN if it is set in settings
        if (pinSetting && pinSetting.value) {
            const providedPin = req.headers['x-security-pin'];
            if (!providedPin || typeof providedPin !== 'string') {
                return res.status(403).json({ error: 'Invalid Security PIN' });
            }
            const isMatch = await (0, auth_1.comparePassword)(providedPin, pinSetting.value);
            if (!isMatch) {
                return res.status(403).json({ error: 'Invalid Security PIN' });
            }
        }
        next();
    }
    catch (error) {
        console.error('PIN Verification Error:', error);
        res.status(500).json({ error: 'Security check failed' });
    }
};
exports.verifyPin = verifyPin;
//# sourceMappingURL=pin.js.map