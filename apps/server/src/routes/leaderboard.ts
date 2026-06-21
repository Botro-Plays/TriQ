import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// GET /api/v1/leaderboards/drivers — driver leaderboard
// Query: period=week|month|alltime, metric=rides|earnings|rating, page, limit
router.get('/drivers', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'week';
    const metric = (req.query.metric as string) || 'rides';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }

    if (metric === 'rating') {
      // Average rating — needs at least 1 review in period
      const drivers = await prisma.driver.findMany({
        where: {
          reviewCount: { gte: 1 },
          status: { not: 'SUSPENDED' },
        },
        orderBy: { rating: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, plateNumber: true, photoUrl: true,
          rating: true, reviewCount: true, totalRides: true,
          subscriptionTier: true,
        },
      });
      const total = await prisma.driver.count({ where: { reviewCount: { gte: 1 }, status: { not: 'SUSPENDED' } } });
      res.json({ entries: drivers.map((d, i) => ({ ...d, rank: (page - 1) * limit + i + 1, score: d.rating })), total, page, pages: Math.ceil(total / limit) });
      return;
    }

    // For rides and earnings, aggregate from Ride table
    const rideWhere: any = { status: 'COMPLETED' };
    if (startDate) rideWhere.completedAt = { gte: startDate };

    if (metric === 'rides') {
      const results = await prisma.ride.groupBy({
        by: ['driverId'],
        where: { ...rideWhere, driverId: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      });

      const driverIds = results.map((r) => r.driverId!).filter(Boolean);
      const drivers = await prisma.driver.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, name: true, plateNumber: true, photoUrl: true, rating: true, totalRides: true, subscriptionTier: true },
      });
      const driverMap = new Map(drivers.map((d) => [d.id, d]));

      const total = await prisma.ride.groupBy({
        by: ['driverId'],
        where: { ...rideWhere, driverId: { not: null } },
        _count: { id: true },
      });

      res.json({
        entries: results.map((r, i) => ({
          ...driverMap.get(r.driverId!),
          rank: (page - 1) * limit + i + 1,
          score: r._count.id,
        })).filter((e) => e.id),
        total: total.length,
        page,
        pages: Math.ceil(total.length / limit),
      });
    } else if (metric === 'earnings') {
      const results = await prisma.ride.groupBy({
        by: ['driverId'],
        where: { ...rideWhere, driverId: { not: null }, finalFare: { not: null } },
        _sum: { finalFare: true },
        orderBy: { _sum: { finalFare: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      });

      const driverIds = results.map((r) => r.driverId!).filter(Boolean);
      const drivers = await prisma.driver.findMany({
        where: { id: { in: driverIds } },
        select: { id: true, name: true, plateNumber: true, photoUrl: true, rating: true, totalRides: true, subscriptionTier: true },
      });
      const driverMap = new Map(drivers.map((d) => [d.id, d]));

      const total = await prisma.ride.groupBy({
        by: ['driverId'],
        where: { ...rideWhere, driverId: { not: null }, finalFare: { not: null } },
        _sum: { finalFare: true },
      });

      res.json({
        entries: results.map((r, i) => ({
          ...driverMap.get(r.driverId!),
          rank: (page - 1) * limit + i + 1,
          score: r._sum.finalFare || 0,
        })).filter((e) => e.id),
        total: total.length,
        page,
        pages: Math.ceil(total.length / limit),
      });
    } else {
      res.status(400).json({ error: 'Invalid metric. Use: rides, earnings, rating' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get driver leaderboard', message: err.message });
  }
});

// GET /api/v1/leaderboards/passengers — passenger leaderboard
// Query: period=week|month|alltime, metric=rides|tips|ratings, page, limit
router.get('/passengers', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'week';
    const metric = (req.query.metric as string) || 'rides';
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const now = new Date();
    let startDate: Date | undefined;
    if (period === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    }

    const rideWhere: any = { status: 'COMPLETED' };
    if (startDate) rideWhere.completedAt = { gte: startDate };

    if (metric === 'rides') {
      const results = await prisma.ride.groupBy({
        by: ['passengerId'],
        where: rideWhere,
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      });

      const passengerIds = results.map((r) => r.passengerId);
      const passengers = await prisma.passenger.findMany({
        where: { id: { in: passengerIds } },
        select: { id: true, name: true, photoUrl: true, trustScore: true },
      });
      const passengerMap = new Map(passengers.map((p) => [p.id, p]));

      const total = await prisma.ride.groupBy({
        by: ['passengerId'],
        where: rideWhere,
        _count: { id: true },
      });

      res.json({
        entries: results.map((r, i) => ({
          ...passengerMap.get(r.passengerId),
          rank: (page - 1) * limit + i + 1,
          score: r._count.id,
        })).filter((e) => e.id),
        total: total.length,
        page,
        pages: Math.ceil(total.length / limit),
      });
    } else if (metric === 'tips') {
      const tipWhere: any = { status: 'PAID' };
      if (startDate) tipWhere.createdAt = { gte: startDate };

      const results = await prisma.tip.groupBy({
        by: ['passengerId'],
        where: tipWhere,
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      });

      const passengerIds = results.map((r) => r.passengerId);
      const passengers = await prisma.passenger.findMany({
        where: { id: { in: passengerIds } },
        select: { id: true, name: true, photoUrl: true, trustScore: true },
      });
      const passengerMap = new Map(passengers.map((p) => [p.id, p]));

      const total = await prisma.tip.groupBy({
        by: ['passengerId'],
        where: tipWhere,
        _sum: { amount: true },
      });

      res.json({
        entries: results.map((r, i) => ({
          ...passengerMap.get(r.passengerId),
          rank: (page - 1) * limit + i + 1,
          score: r._sum.amount || 0,
          tipCount: r._count.id,
        })).filter((e) => e.id),
        total: total.length,
        page,
        pages: Math.ceil(total.length / limit),
      });
    } else if (metric === 'ratings') {
      // Passengers ranked by average rating they gave (positive contributors)
      const reviewWhere: any = {};
      if (startDate) reviewWhere.createdAt = { gte: startDate };

      const results = await prisma.review.groupBy({
        by: ['fromPassengerId'],
        where: reviewWhere,
        _avg: { rating: true },
        _count: { id: true },
        orderBy: { _avg: { rating: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      });

      const passengerIds = results.map((r) => r.fromPassengerId);
      const passengers = await prisma.passenger.findMany({
        where: { id: { in: passengerIds } },
        select: { id: true, name: true, photoUrl: true, trustScore: true },
      });
      const passengerMap = new Map(passengers.map((p) => [p.id, p]));

      const total = await prisma.review.groupBy({
        by: ['fromPassengerId'],
        where: reviewWhere,
        _avg: { rating: true },
      });

      res.json({
        entries: results.map((r, i) => ({
          ...passengerMap.get(r.fromPassengerId),
          rank: (page - 1) * limit + i + 1,
          score: r._avg.rating || 0,
          reviewCount: r._count.id,
        })).filter((e) => e.id),
        total: total.length,
        page,
        pages: Math.ceil(total.length / limit),
      });
    } else {
      res.status(400).json({ error: 'Invalid metric. Use: rides, tips, ratings' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get passenger leaderboard', message: err.message });
  }
});

export default router;
