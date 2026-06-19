"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// POST /api/v1/reports — create report
router.post('/', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// GET /api/v1/reports/:id — get report details
router.get('/:id', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
exports.default = router;
//# sourceMappingURL=report.js.map