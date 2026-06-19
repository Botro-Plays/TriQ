import { Router } from 'express';

const router = Router();

// POST /api/v1/rides — create ride request
router.post('/', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/rides/:id — get ride details
router.get('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/accept — driver accepts ride
router.post('/:id/accept', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/decline — driver declines ride
router.post('/:id/decline', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/cancel — passenger or driver cancels
router.post('/:id/cancel', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/complete — driver marks ride complete
router.post('/:id/complete', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/counter-offer — driver proposes counter fare
router.post('/:id/counter-offer', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/counter-offer/accept — passenger accepts
router.post('/:id/counter-offer/accept', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/counter-offer/reject — passenger rejects
router.post('/:id/counter-offer/reject', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/rides/active — get active/pending ride for current user
router.get('/active', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// POST /api/v1/rides/:id/emergency — trigger emergency alert
router.post('/:id/emergency', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

export default router;
