"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// GET /api/v1/passengers/:id — get passenger profile
router.get('/:id', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// POST /api/v1/passengers/:id/kyc — submit KYC documents
router.post('/:id/kyc', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// GET /api/v1/passengers/:id/rides — ride history
router.get('/:id/rides', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// GET /api/v1/passengers/:id/badges — earned badges
router.get('/:id/badges', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// GET /api/v1/passengers/:id/points — points history
router.get('/:id/points', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// POST /api/v1/passengers/:id/places — save favorite place
router.post('/:id/places', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
// GET /api/v1/passengers/:id/places — saved places
router.get('/:id/places', (_req, res) => {
    res.status(501).json({ message: 'Not implemented' });
});
exports.default = router;
//# sourceMappingURL=passenger.js.map