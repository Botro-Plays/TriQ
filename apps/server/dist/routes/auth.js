"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// POST /api/v1/auth/verify-phone — send OTP via Firebase
router.post('/verify-phone', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// POST /api/v1/auth/verify-otp — confirm OTP, return custom token
router.post('/verify-otp', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// POST /api/v1/auth/refresh — refresh Firebase custom token
router.post('/refresh', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// POST /api/v1/auth/logout — invalidate token, clear sessions
router.post('/logout', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
exports.default = router;
//# sourceMappingURL=auth.js.map