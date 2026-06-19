import { Router } from 'express';

const router = Router();

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

export default router;
