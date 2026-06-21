import { Router } from 'express';
import { prisma } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/gamification/badges — list all available badges
router.get('/badges', async (_req, res) => {
  try {
    const badges = await prisma.badge.findMany({
      orderBy: { createdAt: 'asc' },
    });
    res.json({ badges });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get badges', message: err.message });
  }
});

// GET /api/v1/gamification/badges/me — my earned badges (driver or passenger)
router.get('/badges/me', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role === 'DRIVER') {
      const driver = await prisma.driver.findUnique({ where: { userId } });
      if (!driver) {
        res.status(404).json({ error: 'Driver profile not found' });
        return;
      }
      const badges = await prisma.driverBadge.findMany({
        where: { driverId: driver.id },
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      });
      const points = await prisma.driverPoints.findMany({
        where: { driverId: driver.id },
        orderBy: { createdAt: 'desc' },
      });
      const totalPoints = points.reduce((sum, p) => sum + p.points, 0);
      res.json({ badges, points, totalPoints });
    } else if (role === 'PASSENGER') {
      const passenger = await prisma.passenger.findUnique({ where: { userId } });
      if (!passenger) {
        res.status(404).json({ error: 'Passenger profile not found' });
        return;
      }
      const badges = await prisma.passengerBadge.findMany({
        where: { passengerId: passenger.id },
        include: { badge: true },
        orderBy: { awardedAt: 'desc' },
      });
      const points = await prisma.passengerPoints.findMany({
        where: { passengerId: passenger.id },
        orderBy: { createdAt: 'desc' },
      });
      const totalPoints = points.reduce((sum, p) => sum + p.points, 0);
      res.json({ badges, points, totalPoints });
    } else {
      res.status(403).json({ error: 'Only drivers and passengers can earn badges' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get badges', message: err.message });
  }
});

// GET /api/v1/gamification/challenges/active — active seasonal challenges
router.get('/challenges/active', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const role = req.user!.role;

    const challenges = await prisma.seasonalChallenge.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
        targetRole: role as any,
      },
      orderBy: { endDate: 'asc' },
    });

    res.json({ challenges });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get challenges', message: err.message });
  }
});

// POST /api/v1/gamification/points/award — award points to a driver or passenger
// Used internally by ride completion, rating submission, etc.
router.post('/points/award', async (req: AuthRequest, res) => {
  try {
    const { targetId, targetType, points, reason, rideId } = req.body;
    if (!targetId || !targetType || typeof points !== 'number' || !reason) {
      res.status(400).json({ error: 'targetId, targetType, points, reason are required' });
      return;
    }

    if (targetType === 'DRIVER') {
      const entry = await prisma.driverPoints.create({
        data: { driverId: targetId, points, reason, rideId: rideId || null },
      });
      res.status(201).json(entry);
    } else if (targetType === 'PASSENGER') {
      const entry = await prisma.passengerPoints.create({
        data: { passengerId: targetId, points, reason, rideId: rideId || null },
      });
      res.status(201).json(entry);
    } else {
      res.status(400).json({ error: 'targetType must be DRIVER or PASSENGER' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to award points', message: err.message });
  }
});

export default router;
