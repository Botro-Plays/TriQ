"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// POST /api/v1/tips — create platform tip (PayMongo checkout)
router.post('/', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// POST /api/v1/tips/webhook — PayMongo webhook handler
router.post('/webhook', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// GET /api/v1/tips/:id/status — check tip payment status
router.get('/:id/status', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
exports.default = router;
//# sourceMappingURL=tip.js.map