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

      const passengerIds = results.map((r) => r.passengerId).filter((id): id is string => id !== null);
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
          ...(r.passengerId ? passengerMap.get(r.passengerId) : undefined),
          rank: (page - 1) * limit + i + 1,
          score: r._sum.amount || 0,
          tipCount: r._count.id,
        })).filter((e) => e?.id),
        total: total.length,
        page,
        pages: Math.ceil(total.length / limit),
      });
    } else if (metric === 'ratings') {
      // Passengers ranked by driver thumbs-up approval rate
      // Score = percentage of driver feedback that is thumbs up (0-100)
      const feedbackWhere: any = {};
      if (startDate) feedbackWhere.createdAt = { gte: startDate };

      // Get total feedback counts per passenger
      const totalCounts = await prisma.passengerFeedback.groupBy({
        by: ['toPassengerId'],
        where: feedbackWhere,
        _count: { _all: true },
      });

      // Get thumbs-up counts per passenger
      const thumbsUpCounts = await prisma.passengerFeedback.groupBy({
        by: ['toPassengerId'],
        where: { ...feedbackWhere, thumbsUp: true },
        _count: { _all: true },
      });

      const thumbsUpMap = new Map(thumbsUpCounts.map((r) => [r.toPassengerId, r._count._all]));

      // Merge and compute approval rate
      const merged = totalCounts.map((r) => {
        const total = r._count._all;
        const thumbsUp = thumbsUpMap.get(r.toPassengerId) || 0;
        const approvalRate = total > 0 ? Math.round((thumbsUp / total) * 100) : 0;
        return { toPassengerId: r.toPassengerId, total, thumbsUp, approvalRate };
      }).sort((a, b) => b.approvalRate - a.approvalRate || b.thumbsUp - a.thumbsUp);

      const pageResults = merged.slice((page - 1) * limit, page * limit);

      const passengerIds = pageResults.map((r) => r.toPassengerId);
      const passengers = await prisma.passenger.findMany({
        where: { id: { in: passengerIds } },
        select: { id: true, name: true, photoUrl: true, trustScore: true },
      });
      const passengerMap = new Map(passengers.map((p) => [p.id, p]));

      res.json({
        entries: pageResults.map((r, i) => ({
          ...passengerMap.get(r.toPassengerId),
          rank: (page - 1) * limit + i + 1,
          score: r.approvalRate,
          feedbackCount: r.total,
          thumbsUpCount: r.thumbsUp,
        })).filter((e) => e.id),
        total: merged.length,
        page,
        pages: Math.ceil(merged.length / limit),
      });
    } else {
      res.status(400).json({ error: 'Invalid metric. Use: rides, tips, ratings' });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get passenger leaderboard', message: err.message });
  }
});

export default router;
