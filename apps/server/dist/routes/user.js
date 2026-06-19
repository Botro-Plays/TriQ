"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// GET /api/v1/users/me — current authenticated user
router.get('/me', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// PATCH /api/v1/users/me — update profile
router.patch('/me', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// DELETE /api/v1/users/me — deactivate account
router.delete('/me', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
exports.default = router;
//# sourceMappingURL=user.js.map