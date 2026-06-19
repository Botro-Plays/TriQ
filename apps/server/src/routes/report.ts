import { Router } from 'express';

const router = Router();

// POST /api/v1/reports — create report
router.post('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/reports/:id — get report details
router.get('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

export default router;
