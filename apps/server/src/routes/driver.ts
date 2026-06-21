import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type NearbyDriver = {
  id: string;
  name: string;
  plateNumber: string;
  tricycleModel: string | null;
  photoUrl: string | null;
  rating: number;
  totalRides: number;
  currentLat: number | null;
  currentLng: number | null;
  pickupRadius: number;
  subscriptionTier: string;
  subscriptionStatus: string;
};

function tierWeight(tier: string, status: string): number {
  if (status !== 'ACTIVE') return 0;
  if (tier === 'ELITE') return 3;
  if (tier === 'PRO') return 2;
  return 0; // FREE
}

// GET /api/v1/drivers?userId=xxx — get driver by user ID
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      res.status(400).json({ error: 'userId query param required' });
      return;
    }
    const driver = await prisma.driver.findUnique({
      where: { userId: userId as string },
      select: { id: true, name: true, isOnline: true, status: true, rating: true, totalRides: true, reviewCount: true, plateNumber: true, currentLat: true, currentLng: true, pickupRadius: true },
    });
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get driver', message: err.message });
  }
});

// GET /api/v1/drivers/nearby — find nearby online drivers (query: lat, lng, radius)
router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat(req.query.radius as string) || 3;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const onlineDrivers: NearbyDriver[] = await prisma.driver.findMany({
      where: {
        isOnline: true,
        status: 'VERIFIED',
        currentLat: { not: null },
        currentLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        tricycleModel: true,
        photoUrl: true,
        rating: true,
        totalRides: true,
        currentLat: true,
        currentLng: true,
        pickupRadius: true,
        subscriptionTier: true,
        subscriptionStatus: true,
      },
    });

    const nearby = onlineDrivers
      .filter((d: NearbyDriver) => {
        if (d.currentLat == null || d.currentLng == null) return false;
        const dist = haversine(lat, lng, d.currentLat, d.currentLng);
        // ELITE drivers get 1.2x pickup radius bonus — wider visibility
        const effectivePickupRadius =
          (d.subscriptionTier === 'ELITE' && d.subscriptionStatus === 'ACTIVE')
            ? d.pickupRadius * 1.2
            : d.pickupRadius;
        return dist <= Math.max(radiusKm, effectivePickupRadius);
      })
      .map((d: NearbyDriver) => ({
        ...d,
        distance: haversine(lat, lng, d.currentLat!, d.currentLng!),
        tierWeight: tierWeight(d.subscriptionTier, d.subscriptionStatus),
      }))
      // Sort: ELITE first → PRO → FREE, then by distance within each tier
      .sort((a, b) => b.tierWeight - a.tierWeight || a.distance - b.distance);

    res.json({ drivers: nearby });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to find nearby drivers', message: err.message });
  }
});

// GET /api/v1/drivers/:id — get driver profile
router.get('/:id', async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        plateNumber: true,
        tricycleModel: true,
        photoUrl: true,
        rating: true,
        totalRides: true,
        totalEarnings: true,
        isOnline: true,
        status: true,
        kycStatus: true,
        pickupRadius: true,
        subscriptionTier: true,
      },
    });
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get driver', message: err.message });
  }
});

// PATCH /api/v1/drivers/:id/online — go online with location
router.patch('/:id/online', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: {
        isOnline: true,
        currentLat: lat,
        currentLng: lng,
        lastOnlineAt: new Date(),
      },
      select: { id: true, isOnline: true, currentLat: true, currentLng: true },
    });
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to go online', message: err.message });
  }
});

// PATCH /api/v1/drivers/:id/offline — go offline
router.patch('/:id/offline', async (req, res) => {
  try {
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { isOnline: false, currentLat: null, currentLng: null },
      select: { id: true, isOnline: true },
    });
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to go offline', message: err.message });
  }
});

// PATCH /api/v1/drivers/:id/location — update current location
router.patch('/:id/location', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    await prisma.driver.update({
      where: { id: req.params.id },
      data: { currentLat: lat, currentLng: lng },
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update location', message: err.message });
  }
});

// PATCH /api/v1/drivers/:id/radius — update pickup radius
router.patch('/:id/radius', async (req, res) => {
  try {
    const { radius } = req.body;
    if (typeof radius !== 'number' || radius < 0.5 || radius > 20) {
      res.status(400).json({ error: 'radius must be between 0.5 and 20 km' });
      return;
    }

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { pickupRadius: radius },
      select: { id: true, pickupRadius: true },
    });
    res.json(driver);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update radius', message: err.message });
  }
});

// GET /api/v1/drivers/:id/rides — ride history
router.get('/:id/rides', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const rides = await prisma.ride.findMany({
      where: { driverId: req.params.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        estimatedFare: true,
        finalFare: true,
        createdAt: true,
        completedAt: true,
        passenger: { select: { name: true } },
      },
    });
    res.json({ rides, page });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get rides', message: err.message });
  }
});

// GET /api/v1/drivers/:id/earnings — earnings summary
router.get('/:id/earnings', async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [todayRides, monthRides, weekRides, totalRides] = await Promise.all([
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED', completedAt: { gte: startOfToday } },
        _sum: { finalFare: true, estimatedFare: true },
        _count: true,
      }),
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED', completedAt: { gte: startOfMonth } },
        _sum: { finalFare: true, estimatedFare: true },
        _count: true,
      }),
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED', completedAt: { gte: startOfWeek } },
        _sum: { finalFare: true, estimatedFare: true },
        _count: true,
      }),
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED' },
        _sum: { finalFare: true, estimatedFare: true },
        _count: true,
      }),
    ]);

    // Use finalFare if available, otherwise fall back to estimatedFare
    const pickFare = (agg: { _sum: { finalFare: number | null; estimatedFare: number | null } }) =>
      agg._sum.finalFare ?? agg._sum.estimatedFare ?? 0;

    res.json({
      today: { earnings: pickFare(todayRides), rides: todayRides._count },
      week: { earnings: pickFare(weekRides), rides: weekRides._count },
      month: { earnings: pickFare(monthRides), rides: monthRides._count },
      total: { earnings: pickFare(totalRides), rides: totalRides._count },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get earnings', message: err.message });
  }
});

// POST /api/v1/drivers/:id/kyc — submit KYC documents
router.post('/:id/kyc', async (req, res) => {
  try {
    const { documents } = req.body;
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: 'documents array is required' });
      return;
    }

    const driver = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Validate each document
    for (const doc of documents) {
      if (!doc.type || !doc.url) {
        res.status(400).json({ error: 'Each document must have type and url' });
        return;
      }
    }

    // Create all document records
    const created = await prisma.$transaction(
      documents.map((doc: { type: string; url: string }) =>
        prisma.document.create({
          data: {
            driverId: driver.id,
            type: doc.type as any,
            url: doc.url,
            status: 'PENDING',
          },
        })
      )
    );

    await prisma.driver.update({
      where: { id: driver.id },
      data: { kycStatus: 'PENDING_REVIEW' },
    });

    res.status(201).json({ documents: created });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit KYC', message: err.message });
  }
});

// GET /api/v1/drivers/:id/kyc — get driver's KYC documents and status
router.get('/:id/kyc', async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      select: { id: true, kycStatus: true, kycRejectionReason: true },
    });
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    const documents = await prisma.document.findMany({
      where: { driverId: driver.id },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ ...driver, documents });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get KYC status', message: err.message });
  }
});

// GET /api/v1/drivers/:id/badges — earned badges
router.get('/:id/badges', async (req, res) => {
  try {
    const badges = await prisma.driverBadge.findMany({
      where: { driverId: req.params.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });
    res.json({ badges });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get badges', message: err.message });
  }
});

// GET /api/v1/drivers/:id/points — points history
router.get('/:id/points', async (req, res) => {
  try {
    const points = await prisma.driverPoints.findMany({
      where: { driverId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    const total = points.reduce((sum, p) => sum + p.points, 0);
    res.json({ points, total });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get points', message: err.message });
  }
});

// POST /api/v1/drivers/:id/report-passenger — driver reports a passenger
router.post('/:id/report-passenger', async (req, res) => {
  try {
    const { rideId, category, description } = req.body;
    if (!rideId || !category) {
      res.status(400).json({ error: 'rideId and category are required' });
      return;
    }

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.driverId !== req.params.id) {
      res.status(403).json({ error: 'You can only report passengers from your own rides' });
      return;
    }

    const severity = ['Harassment'].includes(category) ? 'HIGH'
      : ['No-show', 'Refused to pay', 'Abusive behavior'].includes(category) ? 'MEDIUM'
      : 'LOW';

    const report = await prisma.report.create({
      data: {
        rideId,
        reporterId: req.params.id,
        reportedId: ride.passengerId,
        reporterRole: 'DRIVER',
        reportedRole: 'PASSENGER',
        category,
        severity,
        description: description || null,
      },
    });

    res.status(201).json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create report', message: err.message });
  }
});

// PATCH /api/v1/drivers/:id/fcm-token — save FCM push token
router.patch('/:id/fcm-token', async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) { res.status(400).json({ error: 'fcmToken is required' }); return; }
    await prisma.driver.update({ where: { id: req.params.id }, data: { fcmToken } as any });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save FCM token', message: err.message });
  }
});

export default router;
