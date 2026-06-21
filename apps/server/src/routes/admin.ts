import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// GET /api/v1/admin/stats/overview — platform metrics
router.get('/stats/overview', async (_req, res) => {
  try {
    const [
      totalPassengers, totalDrivers, totalRides,
      activeRides, pendingKyc, completedRides,
      onlineDrivers, suspendedDrivers,
    ] = await Promise.all([
      prisma.passenger.count(),
      prisma.driver.count(),
      prisma.ride.count(),
      prisma.ride.count({ where: { status: { in: ['REQUESTED', 'ACCEPTED', 'ARRIVING', 'IN_PROGRESS'] } } }),
      prisma.driver.count({ where: { kycStatus: 'PENDING_REVIEW' } }),
      prisma.ride.count({ where: { status: 'COMPLETED' } }),
      prisma.driver.count({ where: { isOnline: true } }),
      prisma.driver.count({ where: { status: 'SUSPENDED' } }),
    ]);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRides = await prisma.ride.count({ where: { createdAt: { gte: todayStart } } });

    const [subscriptionAgg, tipAgg, activeSubs, proSubs, faresAgg] = await Promise.all([
      prisma.subscription.aggregate({
        where: { status: 'ACTIVE' },
        _sum: { amount: true },
      }),
      prisma.tip.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', tier: 'PRO' } }),
      prisma.ride.aggregate({
        where: { status: 'COMPLETED', finalFare: { not: null } },
        _sum: { finalFare: true },
      }),
    ]);

    const subscriptionRevenue = subscriptionAgg._sum.amount || 0;
    const tipRevenue = tipAgg._sum.amount || 0;

    res.json({
      totalPassengers,
      totalDrivers,
      onlineDrivers,
      totalRides,
      activeRides,
      todayRides,
      completedRides,
      pendingKyc,
      suspendedDrivers,
      subscriptionRevenue,
      tipRevenue,
      totalPlatformRevenue: subscriptionRevenue + tipRevenue,
      activeSubscriptions: activeSubs,
      proSubscriptions: proSubs,
      totalFares: faresAgg._sum.finalFare || 0,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get stats', message: err.message });
  }
});

// GET /api/v1/admin/kyc/pending — list pending KYC documents
router.get('/kyc/pending', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          driver: { select: { id: true, name: true, plateNumber: true } },
          passenger: { select: { id: true, name: true } },
        },
      }),
      prisma.document.count({ where: { status: 'PENDING' } }),
    ]);

    res.json({ documents, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get pending KYC', message: err.message });
  }
});

// POST /api/v1/admin/kyc/:documentId/approve
router.post('/kyc/:documentId/approve', async (req, res) => {
  try {
    const doc = await prisma.document.update({
      where: { id: req.params.documentId },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: req.body.reviewerId || 'admin' },
    });

    // Update driver/passenger KYC status
    if (doc.driverId) {
      await prisma.driver.update({
        where: { id: doc.driverId },
        data: { kycStatus: 'VERIFIED', kycReviewedAt: new Date(), kycReviewedBy: req.body.reviewerId || 'admin' },
      });
    }
    if (doc.passengerId) {
      await prisma.passenger.update({
        where: { id: doc.passengerId },
        data: { kycStatus: 'VERIFIED', kycReviewedAt: new Date(), kycReviewedBy: req.body.reviewerId || 'admin' },
      });
    }

    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to approve KYC', message: err.message });
  }
});

// POST /api/v1/admin/kyc/:documentId/reject
router.post('/kyc/:documentId/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const doc = await prisma.document.update({
      where: { id: req.params.documentId },
      data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: req.body.reviewerId || 'admin', rejectionReason: reason },
    });

    if (doc.driverId) {
      await prisma.driver.update({
        where: { id: doc.driverId },
        data: { kycStatus: 'REJECTED', kycReviewedAt: new Date(), kycReviewedBy: req.body.reviewerId || 'admin', kycRejectionReason: reason },
      });
    }
    if (doc.passengerId) {
      await prisma.passenger.update({
        where: { id: doc.passengerId },
        data: { kycStatus: 'REJECTED', kycReviewedAt: new Date(), kycReviewedBy: req.body.reviewerId || 'admin', kycRejectionReason: reason },
      });
    }

    res.json(doc);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reject KYC', message: err.message });
  }
});

// GET /api/v1/admin/drivers — list all drivers
router.get('/drivers', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const status = req.query.status as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        orderBy: { lastOnlineAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, plateNumber: true, status: true, isOnline: true,
          rating: true, totalRides: true, kycStatus: true, subscriptionTier: true,
          lastOnlineAt: true,
        },
      }),
      prisma.driver.count({ where }),
    ]);

    res.json({ drivers, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get drivers', message: err.message });
  }
});

// PATCH /api/v1/admin/drivers/:id/suspend
router.patch('/drivers/:id/suspend', async (req, res) => {
  try {
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { status: 'SUSPENDED', isOnline: false },
    });
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to suspend driver', message: err.message });
  }
});

// PATCH /api/v1/admin/drivers/:id/unsuspend
router.patch('/drivers/:id/unsuspend', async (req, res) => {
  try {
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { status: 'VERIFIED' },
    });
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unsuspend driver', message: err.message });
  }
});

// GET /api/v1/admin/rides — list rides with filters
router.get('/rides', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const status = req.query.status as string;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [rides, total] = await Promise.all([
      prisma.ride.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          passenger: { select: { name: true } },
          driver: { select: { name: true, plateNumber: true } },
        },
      }),
      prisma.ride.count({ where }),
    ]);

    res.json({ rides, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get rides', message: err.message });
  }
});

// GET /api/v1/admin/reports — list reports
router.get('/reports', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ride: { select: { id: true, pickupAddress: true, dropoffAddress: true } },
        },
      }),
      prisma.report.count(),
    ]);

    res.json({ reports, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get reports', message: err.message });
  }
});

// POST /api/v1/admin/reports/:id/resolve
router.post('/reports/:id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    const report = await prisma.report.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolution },
    });
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to resolve report', message: err.message });
  }
});

// GET /api/v1/admin/users — list all users (for owner to promote to staff)
router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const role = req.query.role as string;

    const where: any = {};
    if (role && role !== 'all') {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, phoneNumber: true, email: true, role: true, createdAt: true,
          passenger: { select: { name: true } },
          driver: { select: { name: true, plateNumber: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get users', message: err.message });
  }
});

// PATCH /api/v1/admin/users/:id/role — update user role (owner only)
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['PASSENGER', 'DRIVER', 'STAFF'].includes(role)) {
      res.status(400).json({ error: 'Invalid role. Can only set PASSENGER, DRIVER, or STAFF' });
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { role },
      select: { id: true, phoneNumber: true, email: true, role: true },
    });
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update role', message: err.message });
  }
});

// GET /api/v1/admin/subscriptions — list subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const status = req.query.status as string;

    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          driver: { select: { id: true, name: true, plateNumber: true, subscriptionTier: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    const revenueAgg = await prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true },
    });

    res.json({ subscriptions: subs, total, page, pages: Math.ceil(total / limit), activeRevenue: revenueAgg._sum.amount || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get subscriptions', message: err.message });
  }
});

// GET /api/v1/admin/tips — list tip transactions
router.get('/tips', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const status = req.query.status as string;

    const where: any = {};
    if (status && status !== 'all') where.status = status;

    const [tips, total] = await Promise.all([
      prisma.tip.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          passenger: { select: { id: true, name: true } },
          ride: { select: { id: true, driver: { select: { name: true, plateNumber: true } } } },
        },
      }),
      prisma.tip.count({ where }),
    ]);

    const paidAgg = await prisma.tip.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    res.json({ tips, total, page, pages: Math.ceil(total / limit), totalPaid: paidAgg._sum.amount || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get tips', message: err.message });
  }
});

// GET /api/v1/admin/passengers — list passengers
router.get('/passengers', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const search = req.query.search as string;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [passengers, total] = await Promise.all([
      prisma.passenger.findMany({
        where,
        orderBy: { trustScore: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, kycStatus: true, trustScore: true,
          autoCancelledCount: true, userId: true,
          user: { select: { phoneNumber: true, createdAt: true } },
          _count: { select: { rides: true, strikes: true } },
        },
      }),
      prisma.passenger.count({ where }),
    ]);

    res.json({ passengers, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get passengers', message: err.message });
  }
});

// PATCH /api/v1/admin/passengers/:id/suspend — suspend passenger (set trust score to 0)
router.patch('/passengers/:id/suspend', async (req, res) => {
  try {
    const passenger = await prisma.passenger.update({
      where: { id: req.params.id },
      data: { trustScore: 0 },
    });
    res.json(passenger);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to suspend passenger', message: err.message });
  }
});

// PATCH /api/v1/admin/passengers/:id/unsuspend — restore passenger trust score
router.patch('/passengers/:id/unsuspend', async (req, res) => {
  try {
    const passenger = await prisma.passenger.update({
      where: { id: req.params.id },
      data: { trustScore: 100 },
    });
    res.json(passenger);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unsuspend passenger', message: err.message });
  }
});

// GET /api/v1/admin/ratings — list reviews/ratings
router.get('/ratings', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const minRating = parseInt(req.query.minRating as string) || 0;

    const where: any = {};
    if (minRating > 0) where.rating = { lte: minRating };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          from: { select: { name: true } },
          to: { select: { name: true, plateNumber: true } },
          ride: { select: { id: true, pickupAddress: true, dropoffAddress: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    const avgRating = await prisma.review.aggregate({ _avg: { rating: true } });

    res.json({ reviews, total, page, pages: Math.ceil(total / limit), avgRating: avgRating._avg.rating || 0 });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get ratings', message: err.message });
  }
});

// GET /api/v1/admin/strikes — list strikes
router.get('/strikes', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [strikes, total] = await Promise.all([
      prisma.strike.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          passenger: { select: { name: true } },
          ride: { select: { id: true, pickupAddress: true } },
        },
      }),
      prisma.strike.count({ where: { isActive: true } }),
    ]);

    res.json({ strikes, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get strikes', message: err.message });
  }
});

// PATCH /api/v1/admin/strikes/:id/revoke — revoke a strike
router.patch('/strikes/:id/revoke', async (req, res) => {
  try {
    const strike = await prisma.strike.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(strike);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke strike', message: err.message });
  }
});

// GET /api/v1/admin/emergencies — list emergency events
router.get('/emergencies', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [events, total] = await Promise.all([
      prisma.emergencyEvent.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          ride: { select: { id: true, pickupAddress: true, dropoffAddress: true, passenger: { select: { name: true } }, driver: { select: { name: true, plateNumber: true } } } },
        },
      }),
      prisma.emergencyEvent.count(),
    ]);

    res.json({ events, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get emergencies', message: err.message });
  }
});

// PATCH /api/v1/admin/emergencies/:id/resolve — resolve emergency
router.patch('/emergencies/:id/resolve', async (req, res) => {
  try {
    const { notes, status } = req.body;
    const event = await prisma.emergencyEvent.update({
      where: { id: req.params.id },
      data: {
        status: status || 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: req.body.resolverId || 'admin',
        notes,
      },
    });
    res.json(event);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to resolve emergency', message: err.message });
  }
});

// GET /api/v1/admin/config — get all system config (sensitive values masked)
const SENSITIVE_KEY_PATTERNS = ['SECRET', 'KEY', 'TOKEN', 'PASSWORD', 'WEBHOOK'];
const isSensitiveKey = (k: string) => SENSITIVE_KEY_PATTERNS.some((p) => k.toUpperCase().includes(p));
const maskConfigValue = (v: string) => (v.length <= 8 ? '****' : `${v.slice(0, 4)}****${v.slice(-4)}`);

router.get('/config', async (_req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
    res.json({
      configs: configs.map((c) => ({
        ...c,
        value: isSensitiveKey(c.key) ? maskConfigValue(c.value) : c.value,
        masked: isSensitiveKey(c.key),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get config', message: err.message });
  }
});

// PATCH /api/v1/admin/config/:key — update a config value
router.patch('/config/:key', async (req, res) => {
  try {
    const { value } = req.body;
    const config = await prisma.systemConfig.upsert({
      where: { key: req.params.key },
      update: { value },
      create: { key: req.params.key, value },
    });
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update config', message: err.message });
  }
});

// GET /api/v1/admin/audit-log — list audit logs
router.get('/audit-log', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          admin: { select: { phoneNumber: true, email: true } },
        },
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get audit log', message: err.message });
  }
});

// POST /api/v1/admin/ratings/:id/hide — moderate (hide) a review
router.post('/ratings/:id/hide', async (req, res) => {
  try {
    const { reason } = req.body;
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { isHidden: true, hiddenReason: reason || null },
    });
    res.json(review);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to hide review', message: err.message });
  }
});

// POST /api/v1/admin/ratings/:id/unhide — unhide a review
router.post('/ratings/:id/unhide', async (_req, res) => {
  try {
    const review = await prisma.review.update({
      where: { id: _req.params.id },
      data: { isHidden: false, hiddenReason: null },
    });
    res.json(review);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unhide review', message: err.message });
  }
});

// GET /api/v1/admin/thumbs-analytics — aggregate thumbs up/down stats
router.get('/thumbs-analytics', async (_req, res) => {
  try {
    // Driver review thumbs (passenger → driver)
    const driverThumbsUp = await prisma.review.count({ where: { thumbsUp: true } });
    const driverThumbsDown = await prisma.review.count({ where: { thumbsUp: false } });

    // Passenger feedback thumbs (driver → passenger)
    const passengerThumbsUp = await prisma.passengerFeedback.count({ where: { thumbsUp: true } });
    const passengerThumbsDown = await prisma.passengerFeedback.count({ where: { thumbsUp: false } });

    // Per-driver thumbs ratio (top 10 by thumbs up count)
    const driverThumbs = await prisma.review.groupBy({
      by: ['toDriverId'],
      where: { thumbsUp: { not: null } },
      _count: { id: true },
    });

    const driverIds = driverThumbs.map((d) => d.toDriverId);
    const drivers = await prisma.driver.findMany({
      where: { id: { in: driverIds } },
      select: { id: true, name: true, plateNumber: true },
    });
    const driverMap = new Map(drivers.map((d) => [d.id, d]));

    const driverStats = driverThumbs.map((d) => ({
      ...driverMap.get(d.toDriverId),
      totalThumbs: d._count.id,
    })).filter((s) => s.id).sort((a, b) => b.totalThumbs - a.totalThumbs).slice(0, 10);

    // Per-passenger thumbs ratio (top 10 by thumbs up count)
    const passengerThumbs = await prisma.passengerFeedback.groupBy({
      by: ['toPassengerId'],
      _count: { id: true },
    });

    const passengerIds = passengerThumbs.map((p) => p.toPassengerId);
    const passengers = await prisma.passenger.findMany({
      where: { id: { in: passengerIds } },
      select: { id: true, name: true },
    });
    const passengerMap = new Map(passengers.map((p) => [p.id, p]));

    const passengerStats = passengerThumbs.map((p) => ({
      ...passengerMap.get(p.toPassengerId),
      totalFeedback: p._count.id,
    })).filter((s) => s.id).sort((a, b) => b.totalFeedback - a.totalFeedback).slice(0, 10);

    res.json({
      driverThumbs: { up: driverThumbsUp, down: driverThumbsDown },
      passengerThumbs: { up: passengerThumbsUp, down: passengerThumbsDown },
      topDrivers: driverStats,
      topPassengers: passengerStats,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get thumbs analytics', message: err.message });
  }
});

// GET /api/v1/admin/passenger-feedback — list all driver→passenger feedback
router.get('/passenger-feedback', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const thumbsUpFilter = req.query.thumbsUp as string | undefined;

    const where: any = {};
    if (thumbsUpFilter === 'true') where.thumbsUp = true;
    if (thumbsUpFilter === 'false') where.thumbsUp = false;

    const [feedback, total] = await Promise.all([
      prisma.passengerFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          from: { select: { name: true, plateNumber: true } },
          to: { select: { name: true } },
          ride: { select: { id: true, pickupAddress: true, dropoffAddress: true } },
        },
      }),
      prisma.passengerFeedback.count({ where }),
    ]);

    res.json({ feedback, total, page, pages: Math.ceil(total / limit) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get passenger feedback', message: err.message });
  }
});

// GET /api/v1/admin/paymongo — get PayMongo config (masked)
router.get('/paymongo', async (_req, res) => {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: { key: { startsWith: 'PAYMONGO_' } },
    });
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;

    const mask = (v: string | undefined) => {
      if (!v) return '';
      if (v.length <= 8) return '****';
      return v.slice(0, 4) + '****' + v.slice(-4);
    };

    res.json({
      secretKey: mask(map.PAYMONGO_SECRET_KEY),
      publicKey: mask(map.PAYMONGO_PUBLIC_KEY),
      webhookSecret: map.PAYMONGO_WEBHOOK_SECRET ? '****' : '',
      webhookUrl: `https://${process.env.WEB_APP_URL ? new URL(process.env.WEB_APP_URL).host : 'triq.dpdns.org'}/api/v1/tips/webhook`,
      isConfigured: !!(map.PAYMONGO_SECRET_KEY && map.PAYMONGO_PUBLIC_KEY),
      proSubscriptionPrice: map.PAYMONGO_PRO_PRICE ? parseInt(map.PAYMONGO_PRO_PRICE, 10) : 5000,
      eliteSubscriptionPrice: map.PAYMONGO_ELITE_PRICE ? parseInt(map.PAYMONGO_ELITE_PRICE, 10) : 9900,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get PayMongo config', message: err.message });
  }
});

// PUT /api/v1/admin/paymongo — save PayMongo config
router.put('/paymongo', async (req, res) => {
  try {
    const { secretKey, publicKey, webhookSecret, proSubscriptionPrice } = req.body;
    const updates: { key: string; value: string; description: string }[] = [];

    if (secretKey) updates.push({ key: 'PAYMONGO_SECRET_KEY', value: secretKey, description: 'PayMongo Secret API Key' });
    if (publicKey) updates.push({ key: 'PAYMONGO_PUBLIC_KEY', value: publicKey, description: 'PayMongo Public API Key' });
    if (webhookSecret) updates.push({ key: 'PAYMONGO_WEBHOOK_SECRET', value: webhookSecret, description: 'PayMongo Webhook Signing Secret' });
    if (proSubscriptionPrice !== undefined) {
      const priceCentavos = Math.max(5000, Math.round(parseFloat(proSubscriptionPrice) * 100)); // min ₱50
      updates.push({ key: 'PAYMONGO_PRO_PRICE', value: String(priceCentavos), description: 'TriQ Pro subscription price in centavos' });
    }
    const { eliteSubscriptionPrice } = req.body;
    if (eliteSubscriptionPrice !== undefined) {
      const priceCentavos = Math.max(9900, Math.round(parseFloat(eliteSubscriptionPrice) * 100)); // min ₱99
      updates.push({ key: 'PAYMONGO_ELITE_PRICE', value: String(priceCentavos), description: 'TriQ Elite subscription price in centavos' });
    }

    for (const u of updates) {
      await prisma.systemConfig.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value, description: u.description },
      });
    }

    res.json({ success: true, updated: updates.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save PayMongo config', message: err.message });
  }
});

export default router;
