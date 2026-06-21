import { Router } from 'express';
import { prisma } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/users/me — current authenticated user with profile
router.get('/me', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        phoneNumber: true,
        email: true,
        role: true,
        createdAt: true,
        passenger: { select: { id: true, name: true, photoUrl: true, kycStatus: true, trustScore: true } },
        driver: { select: { id: true, name: true, photoUrl: true, status: true, subscriptionTier: true, subscriptionStatus: true } },
      },
    });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get user', message: err.message });
  }
});

// PATCH /api/v1/users/me — update profile (name, photoUrl)
router.patch('/me', async (req: AuthRequest, res) => {
  try {
    const { name, photoUrl, email } = req.body;
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Update email on User if provided
    if (email) {
      await prisma.user.update({ where: { id: userId }, data: { email } });
    }

    // Update name/photoUrl on Passenger or Driver profile
    const updateData: any = {};
    if (name) updateData.name = name;
    if (photoUrl) updateData.photoUrl = photoUrl;

    if (Object.keys(updateData).length > 0) {
      if (user.role === 'PASSENGER') {
        const passenger = await prisma.passenger.findUnique({ where: { userId } });
        if (passenger) {
          await prisma.passenger.update({ where: { id: passenger.id }, data: updateData });
        }
      }
      if (user.role === 'DRIVER') {
        const driver = await prisma.driver.findUnique({ where: { userId } });
        if (driver) {
          await prisma.driver.update({ where: { id: driver.id }, data: updateData });
        }
      }
    }

    res.json({ message: 'Profile updated' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update profile', message: err.message });
  }
});

// DELETE /api/v1/users/me — deactivate account
router.delete('/me', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Set driver offline if applicable
    if (user.role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId } });
      if (driver) {
        await prisma.driver.update({ where: { id: driver.id }, data: { isOnline: false, status: 'SUSPENDED' } });
      }
    }

    // We don't hard-delete — just mark user's role as deactivated by prefixing
    // In a real system we'd have a deactivatedAt field, but we keep it simple
    await prisma.user.update({
      where: { id: userId },
      data: { firebaseUid: `DEACTIVATED_${userId}_${Date.now()}` },
    });

    res.json({ message: 'Account deactivated' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to deactivate account', message: err.message });
  }
});

export default router;
