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

    const earningsAgg = await prisma.ride.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { finalFare: true },
    });

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
      totalEarnings: earningsAgg._sum.finalFare || 0,
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

export default router;
