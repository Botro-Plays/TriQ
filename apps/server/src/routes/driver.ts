import { Router } from 'express';

const router = Router();

// GET /api/v1/drivers/:id — get driver profile
router.get('/:id', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// PATCH /api/v1/drivers/:id/online — go online with location
router.patch('/:id/online', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// PATCH /api/v1/drivers/:id/offline — go offline
router.patch('/:id/offline', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// PATCH /api/v1/drivers/:id/location — update current location
router.patch('/:id/location', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// PATCH /api/v1/drivers/:id/radius — update pickup radius
router.patch('/:id/radius', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/drivers/:id/rides — ride history
router.get('/:id/rides', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/drivers/:id/earnings — earnings summary
router.get('/:id/earnings', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/drivers/:id/badges — earned badges
router.get('/:id/badges', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/drivers/:id/points — points history
router.get('/:id/points', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

// GET /api/v1/drivers/nearby — find nearby drivers (query: lat, lng, radius)
router.get('/nearby', (_req, res) => {
  res.status(501).json({ message: 'Not implemented' });
});

export default router;
