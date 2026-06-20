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
  rating: number;
  totalRides: number;
  currentLat: number | null;
  currentLng: number | null;
  pickupRadius: number;
};

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
      select: { id: true, name: true, isOnline: true, status: true, rating: true, totalRides: true, plateNumber: true },
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
        rating: true,
        totalRides: true,
        currentLat: true,
        currentLng: true,
        pickupRadius: true,
      },
    });

    const nearby = onlineDrivers
      .filter((d: NearbyDriver) => {
        if (d.currentLat == null || d.currentLng == null) return false;
        const dist = haversine(lat, lng, d.currentLat, d.currentLng);
        return dist <= Math.max(radiusKm, d.pickupRadius);
      })
      .map((d: NearbyDriver) => ({
        ...d,
        distance: haversine(lat, lng, d.currentLat!, d.currentLng!),
      }))
      .sort((a: NearbyDriver & { distance: number }, b: NearbyDriver & { distance: number }) => a.distance - b.distance);

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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());

    const [monthRides, weekRides, totalRides] = await Promise.all([
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED', completedAt: { gte: startOfMonth } },
        _sum: { finalFare: true },
        _count: true,
      }),
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED', completedAt: { gte: startOfWeek } },
        _sum: { finalFare: true },
        _count: true,
      }),
      prisma.ride.aggregate({
        where: { driverId: req.params.id, status: 'COMPLETED' },
        _sum: { finalFare: true },
        _count: true,
      }),
    ]);

    res.json({
      today: { earnings: 0, rides: 0 },
      week: { earnings: weekRides._sum.finalFare || 0, rides: weekRides._count },
      month: { earnings: monthRides._sum.finalFare || 0, rides: monthRides._count },
      total: { earnings: totalRides._sum.finalFare || 0, rides: totalRides._count },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get earnings', message: err.message });
  }
});

export default router;
