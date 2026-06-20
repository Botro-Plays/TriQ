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

// Calculate fare based on distance and city fare rate
async function calculateFare(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): Promise<number> {
  const distance = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const city = await prisma.city.findFirst({
    where: { isActive: true },
    include: { fareRates: { where: { effectiveUntil: null }, orderBy: { effectiveFrom: 'desc' }, take: 1 } },
  });
  const fareRate = city?.fareRates[0];
  if (!fareRate) return Math.round(distance * 1000 + 1600); // fallback: ₱10/km + ₱16 base
  const distClamped = Math.max(distance, fareRate.minDistance);
  return Math.round(fareRate.baseFare + distClamped * fareRate.perKmRate);
}

// POST /api/v1/rides — create ride request
router.post('/', async (req, res) => {
  try {
    const {
      passengerId,
      pickupLat, pickupLng, pickupAddress,
      dropoffLat, dropoffLng, dropoffAddress,
      passengerCount = 1,
      hasSeniorCitizen = false,
      hasStudent = false,
      hasExtraBaggage = false,
      paymentMethod = 'CASH',
    } = req.body;

    if (!passengerId || typeof pickupLat !== 'number' || typeof dropoffLat !== 'number') {
      res.status(400).json({ error: 'passengerId, pickupLat/Lng, dropoffLat/Lng are required' });
      return;
    }

    // Check for existing active ride
    const existing = await prisma.ride.findFirst({
      where: {
        passengerId,
        status: { in: ['REQUESTED', 'ACCEPTED', 'COUNTER_OFFERED', 'ARRIVING', 'IN_PROGRESS'] },
      },
    });
    if (existing) {
      res.status(409).json({ error: 'You already have an active ride', rideId: existing.id });
      return;
    }

    const estimatedFare = await calculateFare(pickupLat, pickupLng, dropoffLat, dropoffLng);

    const ride = await prisma.ride.create({
      data: {
        passengerId,
        pickupLat, pickupLng, pickupAddress,
        dropoffLat, dropoffLng, dropoffAddress,
        passengerCount,
        hasSeniorCitizen,
        hasStudent,
        hasExtraBaggage,
        paymentMethod,
        estimatedFare,
      },
      include: {
        passenger: { select: { name: true, photoUrl: true } },
      },
    });

    // Create initial status history
    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'REQUESTED', actor: 'PASSENGER' },
    });

    res.status(201).json(ride);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create ride', message: err.message });
  }
});

// GET /api/v1/rides/pending — get pending ride requests for nearby drivers
router.get('/pending', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat(req.query.radius as string) || 5;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    const rides: Array<{ id: string; pickupLat: number; pickupLng: number; [key: string]: any }> = await prisma.ride.findMany({
      where: { status: 'REQUESTED' },
      orderBy: { createdAt: 'asc' },
      take: 20,
      include: {
        passenger: { select: { name: true } },
      },
    });

    const nearby = rides
      .map((r: { id: string; pickupLat: number; pickupLng: number; [key: string]: any }) => ({
        ...r,
        distance: haversine(lat, lng, r.pickupLat, r.pickupLng),
      }))
      .filter((r: { distance: number }) => r.distance <= radiusKm)
      .sort((a: { distance: number }, b: { distance: number }) => a.distance - b.distance);

    res.json({ rides: nearby });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get pending rides', message: err.message });
  }
});

// GET /api/v1/rides/active — get active ride for current user
router.get('/active', async (req, res) => {
  try {
    const { passengerId, driverId } = req.query;

    let where: any = {};
    if (passengerId) {
      where = { passengerId: passengerId as string, status: { in: ['REQUESTED', 'ACCEPTED', 'COUNTER_OFFERED', 'ARRIVING', 'IN_PROGRESS'] } };
    } else if (driverId) {
      where = { driverId: driverId as string, status: { in: ['ACCEPTED', 'COUNTER_OFFERED', 'ARRIVING', 'IN_PROGRESS'] } };
    } else {
      res.status(400).json({ error: 'passengerId or driverId query param required' });
      return;
    }

    const ride = await prisma.ride.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { id: true, name: true, photoUrl: true, phoneNumber: true } },
        driver: { select: { id: true, name: true, plateNumber: true, tricycleModel: true, photoUrl: true, rating: true, currentLat: true, currentLng: true } },
      },
    });

    res.json({ ride });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get active ride', message: err.message });
  }
});

// GET /api/v1/rides/:id — get ride details
router.get('/:id', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: req.params.id },
      include: {
        passenger: { select: { id: true, name: true, photoUrl: true, phoneNumber: true } },
        driver: { select: { id: true, name: true, plateNumber: true, tricycleModel: true, photoUrl: true, rating: true, currentLat: true, currentLng: true } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    res.json(ride);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/accept — driver accepts ride
router.post('/:id/accept', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      res.status(400).json({ error: 'driverId is required' });
      return;
    }

    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'REQUESTED') {
      res.status(409).json({ error: 'Ride is no longer available' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'ACCEPTED', driverId },
      include: {
        passenger: { select: { id: true, name: true, phoneNumber: true } },
        driver: { select: { id: true, name: true, plateNumber: true, tricycleModel: true, rating: true } },
      },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'ACCEPTED', actor: 'DRIVER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/decline — driver declines ride
router.post('/:id/decline', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'REQUESTED') {
      res.status(409).json({ error: 'Ride is no longer available' });
      return;
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to decline ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/cancel — passenger or driver cancels
router.post('/:id/cancel', async (req, res) => {
  try {
    const { reason } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (['COMPLETED', 'CANCELLED'].includes(ride.status)) {
      res.status(409).json({ error: 'Ride cannot be cancelled' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'CANCELLED' },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'CANCELLED', note: reason, actor: 'USER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to cancel ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/arriving — driver marks as arriving
router.post('/:id/arriving', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'ACCEPTED') {
      res.status(409).json({ error: 'Ride is not in ACCEPTED state' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'ARRIVING' },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'ARRIVING', actor: 'DRIVER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/start — driver starts the ride
router.post('/:id/start', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (!['ACCEPTED', 'ARRIVING'].includes(ride.status)) {
      res.status(409).json({ error: 'Ride cannot be started' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'IN_PROGRESS' },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'IN_PROGRESS', actor: 'DRIVER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to start ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/complete — driver marks ride complete
router.post('/:id/complete', async (req, res) => {
  try {
    const { finalFare } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'IN_PROGRESS') {
      res.status(409).json({ error: 'Ride is not in progress' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: 'COMPLETED',
        finalFare: finalFare || ride.estimatedFare,
        completedAt: new Date(),
      },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'COMPLETED', actor: 'DRIVER' },
    });

    // Update driver stats
    if (ride.driverId) {
      await prisma.driver.update({
        where: { id: ride.driverId },
        data: {
          totalRides: { increment: 1 },
          totalEarnings: { increment: finalFare || ride.estimatedFare },
        },
      });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to complete ride', message: err.message });
  }
});

// POST /api/v1/rides/:id/counter-offer — driver proposes counter fare
router.post('/:id/counter-offer', async (req, res) => {
  try {
    const { driverId, fare } = req.body;
    if (!driverId || typeof fare !== 'number') {
      res.status(400).json({ error: 'driverId and fare are required' });
      return;
    }

    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'REQUESTED') {
      res.status(409).json({ error: 'Ride is no longer available' });
      return;
    }

    const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min expiry

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: 'COUNTER_OFFERED',
        counterOfferedFare: fare,
        counterOfferDriverId: driverId,
        counterOfferStatus: 'PENDING',
        counterOfferExpiresAt: expiresAt,
      },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'COUNTER_OFFERED', note: `Fare: ₱${fare / 100}`, actor: 'DRIVER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create counter-offer', message: err.message });
  }
});

// POST /api/v1/rides/:id/counter-offer/accept — passenger accepts
router.post('/:id/counter-offer/accept', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'COUNTER_OFFERED' || !ride.counterOfferDriverId) {
      res.status(409).json({ error: 'No active counter-offer' });
      return;
    }
    if (ride.counterOfferExpiresAt && ride.counterOfferExpiresAt < new Date()) {
      res.status(409).json({ error: 'Counter-offer expired' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: 'COUNTER_OFFER_ACCEPTED',
        driverId: ride.counterOfferDriverId,
        negotiatedFare: ride.counterOfferedFare,
        counterOfferStatus: 'ACCEPTED',
      },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'COUNTER_OFFER_ACCEPTED', actor: 'PASSENGER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to accept counter-offer', message: err.message });
  }
});

// POST /api/v1/rides/:id/counter-offer/reject — passenger rejects
router.post('/:id/counter-offer/reject', async (req, res) => {
  try {
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'COUNTER_OFFERED') {
      res.status(409).json({ error: 'No active counter-offer' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: {
        status: 'REQUESTED',
        counterOfferedFare: null,
        counterOfferDriverId: null,
        counterOfferStatus: 'REJECTED',
        counterOfferExpiresAt: null,
      },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'COUNTER_OFFER_REJECTED', actor: 'PASSENGER' },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reject counter-offer', message: err.message });
  }
});

// POST /api/v1/rides/:id/emergency — trigger emergency alert
router.post('/:id/emergency', async (req, res) => {
  try {
    const { lat, lng, description } = req.body;
    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    const event = await prisma.emergencyEvent.create({
      data: {
        rideId: ride.id,
        lat: lat || null,
        lng: lng || null,
        description: description || 'Emergency triggered',
      },
    });

    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to trigger emergency', message: err.message });
  }
});

export default router;
