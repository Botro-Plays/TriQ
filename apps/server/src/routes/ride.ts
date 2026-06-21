import { Router } from 'express';
import { prisma } from '../lib/db';
import { sendPush } from '../lib/fcm';

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

// Fallback fare estimation using Haversine (when OSRM unavailable)
function estimateFareFallback(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number, baseFare: number, perKmRate: number): number {
  const straightLineKm = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng);
  if (straightLineKm <= 2.5) {
    return baseFare; // ₱16 per person — most Digos rides are short
  }
  const estimatedRoadKm = straightLineKm * 1.3; // roads ~30% longer than straight-line
  return Math.max(baseFare, Math.round(baseFare + (Math.max(0, estimatedRoadKm - 1) * perKmRate)));
}

// Calculate per-person fare based on distance and city fare rate
async function calculatePerPersonFare(pickupLat: number, pickupLng: number, dropoffLat: number, dropoffLng: number): Promise<{ perPersonFare: number; distanceKm: number; baseFare: number; perKmRate: number }> {
  const straightLineKm = haversine(pickupLat, pickupLng, dropoffLat, dropoffLng);
  const city = await prisma.city.findFirst({
    where: { isActive: true },
    include: { fareRates: { where: { effectiveUntil: null }, orderBy: { effectiveFrom: 'desc' }, take: 1 } },
  });
  const fareRate = city?.fareRates[0];

  // Default Digos City rates
  const baseFare = fareRate?.baseFare ?? 1600; // ₱16
  const perKmRate = fareRate?.perKmRate ?? 1000; // ₱10/km

  // TODO: Use OSRM for road distance when available
  // Fallback: Haversine-based estimation
  const perPersonFare = estimateFareFallback(pickupLat, pickupLng, dropoffLat, dropoffLng, baseFare, perKmRate);

  return { perPersonFare, distanceKm: straightLineKm, baseFare, perKmRate };
}

// Extra baggage surcharge in centavos
const EXTRA_BAGGAGE_FEE = 500; // ₱5

// Calculate total fare with per-pax pricing, LGU discount, and baggage fee
async function calculateFare(
  pickupLat: number, pickupLng: number,
  dropoffLat: number, dropoffLng: number,
  passengerCount: number = 1,
  hasSeniorCitizen: boolean = false,
  hasStudent: boolean = false,
  hasExtraBaggage: boolean = false
): Promise<number> {
  const { perPersonFare } = await calculatePerPersonFare(pickupLat, pickupLng, dropoffLat, dropoffLng);

  // Per-pax discount: senior/student passengers get 20% off their portion
  const discountCount = (hasSeniorCitizen ? 1 : 0) + (hasStudent ? 1 : 0);
  const effectiveDiscountCount = Math.min(discountCount, passengerCount);
  const regularCount = passengerCount - effectiveDiscountCount;
  let totalFare = Math.round(
    (regularCount * perPersonFare) + (effectiveDiscountCount * perPersonFare * 0.8)
  );

  // Extra baggage surcharge (flat, once per ride)
  if (hasExtraBaggage) {
    totalFare += EXTRA_BAGGAGE_FEE;
  }

  return totalFare;
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
      seniorCount = hasSeniorCitizen ? 1 : 0,
      studentCount = hasStudent ? 1 : 0,
      driverTip = 0,
      paymentMethod = 'CASH',
      preferredDriverId = null,
    } = req.body;

    if (!passengerId || typeof pickupLat !== 'number' || typeof dropoffLat !== 'number') {
      res.status(400).json({ error: 'passengerId, pickupLat/Lng, dropoffLat/Lng are required' });
      return;
    }

    // If rebook with preferredDriverId, verify driver has active PRO subscription
    if (preferredDriverId) {
      const driver = await prisma.driver.findUnique({
        where: { id: preferredDriverId },
        select: { id: true, subscriptionStatus: true, subscriptionTier: true, status: true },
      });
      if (!driver) {
        res.status(404).json({ error: 'Preferred driver not found' });
        return;
      }
      if (((driver.subscriptionTier as string) !== 'PRO' && (driver.subscriptionTier as string) !== 'ELITE') || driver.subscriptionStatus !== 'ACTIVE') {
        res.status(403).json({ error: 'Driver does not have an active Pro or Elite subscription. Rebook is a paid subscription feature.' });
        return;
      }
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

    // Calculate fare using same per-pax logic as estimate endpoint
    const { perPersonFare } = await calculatePerPersonFare(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const discountCount = Math.min(seniorCount + studentCount, passengerCount);
    const regularCount = passengerCount - discountCount;
    let calculatedFare = Math.round(
      (regularCount * perPersonFare) + (discountCount * perPersonFare * 0.8)
    );
    if (hasExtraBaggage) {
      calculatedFare += EXTRA_BAGGAGE_FEE;
    }
    const estimatedFare = calculatedFare + driverTip;

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
        preferredDriverId,
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

    if (preferredDriverId) {
      // Rebook: notify the preferred driver only
      const prefDriver = await prisma.driver.findUnique({
        where: { id: preferredDriverId },
        select: { fcmToken: true, name: true } as any,
      }) as any;
      if (prefDriver?.fcmToken) {
        await sendPush(prefDriver.fcmToken, {
          title: '🛺 Rebook Request!',
          body: `${ride.passenger.name} is requesting you specifically. Tap to view.`,
          data: { rideId: ride.id, type: 'REBOOK' },
        });
      }
    } else {
      // Regular booking: push notify all online PRO/ELITE drivers within pickup radius
      const vipDrivers = await (prisma.driver as any).findMany({
        where: {
          isOnline: true,
          status: 'VERIFIED',
          subscriptionStatus: 'ACTIVE',
          subscriptionTier: { in: ['PRO', 'ELITE'] },
          currentLat: { not: null },
          currentLng: { not: null },
          fcmToken: { not: null },
        },
        select: { id: true, name: true, fcmToken: true, currentLat: true, currentLng: true, pickupRadius: true, subscriptionTier: true },
      });

      const pickupLat = ride.pickupLat;
      const pickupLng = ride.pickupLng;

      for (const drv of vipDrivers) {
        const dist = haversine(pickupLat, pickupLng, drv.currentLat, drv.currentLng);
        const effectiveRadius = drv.subscriptionTier === 'ELITE' ? drv.pickupRadius * 1.2 : drv.pickupRadius;
        if (dist <= effectiveRadius) {
          await sendPush(drv.fcmToken, {
            title: '🛺 New Ride Request!',
            body: `Pickup: ${ride.pickupAddress} — ${(dist).toFixed(1)} km away. Fare: ₱${(ride.estimatedFare / 100).toFixed(0)}`,
            data: { rideId: ride.id, type: 'NEW_RIDE' },
          });
        }
      }
    }
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
    const driverId = req.query.driverId as string;

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: 'lat and lng are required' });
      return;
    }

    // Auto-cancel stale REQUESTED rides (older than 5 minutes)
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const staleRides = await prisma.ride.findMany({
      where: { status: 'REQUESTED', createdAt: { lt: cutoff } },
      select: { id: true, passengerId: true },
    });
    if (staleRides.length > 0) {
      await Promise.all(staleRides.map(async (r) => {
        await prisma.ride.update({ where: { id: r.id }, data: { status: 'CANCELLED' } });
        await prisma.rideStatus.create({ data: { rideId: r.id, status: 'CANCELLED', actor: 'SYSTEM' } });
        await prisma.passenger.update({ where: { id: r.passengerId }, data: { autoCancelledCount: { increment: 1 } } });
      }));
    }

    // Build where clause: show rebook rides only to the preferred driver
    const where: any = { status: 'REQUESTED' };
    if (driverId) {
      where.OR = [
        { preferredDriverId: null },
        { preferredDriverId: driverId },
      ];
    }

    const rides: Array<{ id: string; pickupLat: number; pickupLng: number; [key: string]: any }> = await prisma.ride.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 20,
      include: {
        passenger: { select: { name: true, user: { select: { phoneNumber: true } } } },
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

// GET /api/v1/rides/estimate — fare estimate before booking
router.get('/estimate', async (req, res) => {
  try {
    const pickupLat = parseFloat(req.query.pickupLat as string);
    const pickupLng = parseFloat(req.query.pickupLng as string);
    const dropoffLat = parseFloat(req.query.dropoffLat as string);
    const dropoffLng = parseFloat(req.query.dropoffLng as string);
    const passengerCount = parseInt(req.query.passengerCount as string) || 1;
    const seniorCount = parseInt(req.query.seniorCount as string) || 0;
    const studentCount = parseInt(req.query.studentCount as string) || 0;
    const hasExtraBaggage = req.query.hasExtraBaggage === 'true';

    if (isNaN(pickupLat) || isNaN(dropoffLat)) {
      res.status(400).json({ error: 'pickupLat, pickupLng, dropoffLat, dropoffLng are required' });
      return;
    }

    const { perPersonFare, distanceKm, baseFare, perKmRate } = await calculatePerPersonFare(pickupLat, pickupLng, dropoffLat, dropoffLng);

    // Advanced per-pax discount: regular passengers pay full, senior/student pay 80%
    const discountCount = Math.min(seniorCount + studentCount, passengerCount);
    const regularCount = passengerCount - discountCount;
    let estimatedFare = Math.round(
      (regularCount * perPersonFare) + (discountCount * perPersonFare * 0.8)
    );

    // Extra baggage surcharge
    let baggageFee = 0;
    if (hasExtraBaggage) {
      baggageFee = EXTRA_BAGGAGE_FEE;
      estimatedFare += baggageFee;
    }

    res.json({
      estimatedFare,
      perPersonFare,
      discountedPerPersonFare: Math.round(perPersonFare * 0.8),
      distanceKm: Math.round(distanceKm * 100) / 100,
      baseFare,
      perKmRate,
      passengerCount,
      seniorCount,
      studentCount,
      discountApplied: discountCount > 0,
      hasExtraBaggage,
      baggageFee,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to estimate fare', message: err.message });
  }
});

// GET /api/v1/rides/active — get active ride for current user
router.get('/active', async (req, res) => {
  try {
    const { passengerId, driverId } = req.query;

    let where: any = {};
    if (passengerId) {
      where = { passengerId: passengerId as string, status: { in: ['REQUESTED', 'ACCEPTED', 'COUNTER_OFFERED', 'COUNTER_OFFER_ACCEPTED', 'ARRIVING', 'IN_PROGRESS'] } };
    } else if (driverId) {
      where = {
        OR: [
          { driverId: driverId as string, status: { in: ['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'ARRIVING', 'IN_PROGRESS'] } },
          { counterOfferDriverId: driverId as string, status: 'COUNTER_OFFERED' },
        ],
      };
    } else {
      res.status(400).json({ error: 'passengerId or driverId query param required' });
      return;
    }

    const ride = await prisma.ride.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { id: true, name: true, photoUrl: true, user: { select: { phoneNumber: true } } } },
        driver: { select: { id: true, name: true, plateNumber: true, tricycleModel: true, photoUrl: true, rating: true, currentLat: true, currentLng: true, user: { select: { phoneNumber: true } } } },
        review: true,
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
        passenger: { select: { id: true, name: true, photoUrl: true, user: { select: { phoneNumber: true } } } },
        driver: { select: { id: true, name: true, plateNumber: true, tricycleModel: true, photoUrl: true, rating: true, currentLat: true, currentLng: true, user: { select: { phoneNumber: true } } } },
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

    // Rebook rides can only be accepted by the preferred driver
    if (ride.preferredDriverId && ride.preferredDriverId !== driverId) {
      res.status(403).json({ error: 'This ride is a rebook request for a specific driver' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'ACCEPTED', driverId },
      include: {
        passenger: { select: { id: true, name: true, user: { select: { phoneNumber: true } } } },
        driver: { select: { id: true, name: true, plateNumber: true, tricycleModel: true, rating: true } },
      },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'ACCEPTED', actor: 'DRIVER' },
    });

    // Push notification: tell passenger their ride was accepted
    const passenger = await prisma.passenger.findUnique({
      where: { id: updated.passenger.id },
      select: { fcmToken: true } as any,
    }) as any;
    if (passenger?.fcmToken) {
      await sendPush(passenger.fcmToken, {
        title: '🎉 Driver Accepted!',
        body: `${updated.driver?.name} (${updated.driver?.plateNumber}) is on the way.`,
        data: { rideId: ride.id, type: 'ACCEPTED' },
      });
    }

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

    // Push: notify the other party about cancellation
    if (ride.driverId) {
      // Passenger cancelled → notify driver
      const drv = await prisma.driver.findUnique({ where: { id: ride.driverId }, select: { fcmToken: true } as any }) as any;
      if (drv?.fcmToken) {
        await sendPush(drv.fcmToken, {
          title: '❌ Ride Cancelled',
          body: 'The passenger has cancelled the ride request.',
          data: { rideId: ride.id, type: 'CANCELLED' },
        });
      }
    }
    if (ride.passengerId) {
      // Driver cancelled → notify passenger
      const pass = await prisma.passenger.findUnique({ where: { id: ride.passengerId }, select: { fcmToken: true } as any }) as any;
      if (pass?.fcmToken) {
        await sendPush(pass.fcmToken, {
          title: '❌ Ride Cancelled',
          body: 'The driver has cancelled the ride. Please request a new one.',
          data: { rideId: ride.id, type: 'CANCELLED' },
        });
      }
    }

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
    if (!['ACCEPTED', 'COUNTER_OFFER_ACCEPTED'].includes(ride.status)) {
      res.status(409).json({ error: 'Ride is not in an accepted state' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'ARRIVING' },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'ARRIVING', actor: 'DRIVER' },
    });

    // Push: notify passenger that driver is arriving
    if (ride.passengerId) {
      const pass = await prisma.passenger.findUnique({ where: { id: ride.passengerId }, select: { fcmToken: true } as any }) as any;
      if (pass?.fcmToken) {
        await sendPush(pass.fcmToken, {
          title: '🛺 Driver is Arriving!',
          body: 'Your driver is on the way to your pickup location.',
          data: { rideId: ride.id, type: 'ARRIVING' },
        });
      }
    }

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
    if (!['ACCEPTED', 'COUNTER_OFFER_ACCEPTED', 'ARRIVING'].includes(ride.status)) {
      res.status(409).json({ error: 'Ride cannot be started' });
      return;
    }

    const updated = await prisma.ride.update({
      where: { id: ride.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    await prisma.rideStatus.create({
      data: { rideId: ride.id, status: 'IN_PROGRESS', actor: 'DRIVER' },
    });

    // Push: notify passenger that ride has started
    if (ride.passengerId) {
      const pass = await prisma.passenger.findUnique({ where: { id: ride.passengerId }, select: { fcmToken: true } as any }) as any;
      if (pass?.fcmToken) {
        await sendPush(pass.fcmToken, {
          title: '🚀 Ride Started',
          body: 'Your ride is now in progress. Enjoy the trip!',
          data: { rideId: ride.id, type: 'STARTED' },
        });
      }
    }

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

    // Push: notify passenger that ride is complete
    if (ride.passengerId) {
      const pass = await prisma.passenger.findUnique({ where: { id: ride.passengerId }, select: { fcmToken: true } as any }) as any;
      if (pass?.fcmToken) {
        await sendPush(pass.fcmToken, {
          title: '✅ Ride Complete!',
          body: `Fare: ₱${((finalFare || ride.estimatedFare) / 100).toFixed(0)}. Please rate your driver.`,
          data: { rideId: ride.id, type: 'COMPLETED' },
        });
      }
    }

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

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min expiry per docs

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

    // Push: notify passenger about counter-offer
    if (ride.passengerId) {
      const pass = await prisma.passenger.findUnique({ where: { id: ride.passengerId }, select: { fcmToken: true } as any }) as any;
      if (pass?.fcmToken) {
        await sendPush(pass.fcmToken, {
          title: '💬 Counter-Offer Received',
          body: `Driver proposed ₱${(fare / 100).toFixed(0)}. Accept or reject within 5 minutes.`,
          data: { rideId: ride.id, type: 'COUNTER_OFFER' },
        });
      }
    }

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

    // Push: notify driver that passenger accepted their counter-offer
    if (ride.counterOfferDriverId) {
      const drv = await prisma.driver.findUnique({ where: { id: ride.counterOfferDriverId }, select: { fcmToken: true } as any }) as any;
      if (drv?.fcmToken) {
        await sendPush(drv.fcmToken, {
          title: '✅ Counter-Offer Accepted!',
          body: 'The passenger accepted your fare. Head to the pickup location.',
          data: { rideId: ride.id, type: 'COUNTER_ACCEPTED' },
        });
      }
    }

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

    // Push: notify driver that passenger rejected their counter-offer
    if (ride.counterOfferDriverId) {
      const drv = await prisma.driver.findUnique({ where: { id: ride.counterOfferDriverId }, select: { fcmToken: true } as any }) as any;
      if (drv?.fcmToken) {
        await sendPush(drv.fcmToken, {
          title: '❌ Counter-Offer Rejected',
          body: 'The passenger rejected your proposed fare.',
          data: { rideId: ride.id, type: 'COUNTER_REJECTED' },
        });
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reject counter-offer', message: err.message });
  }
});

// POST /api/v1/rides/:id/review — passenger rates driver after ride
router.post('/:id/review', async (req, res) => {
  try {
    const { rating, thumbsUp, comment } = req.body;
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'rating must be 1-5' });
      return;
    }

    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'COMPLETED') {
      res.status(409).json({ error: 'Can only review completed rides' });
      return;
    }
    if (!ride.driverId) {
      res.status(400).json({ error: 'No driver to review' });
      return;
    }

    const existing = await prisma.review.findUnique({ where: { rideId: ride.id } });
    if (existing) {
      res.status(409).json({ error: 'Review already submitted' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        rideId: ride.id,
        fromPassengerId: ride.passengerId,
        toDriverId: ride.driverId,
        rating,
        thumbsUp: thumbsUp ?? null,
        comment: comment || null,
      },
    });

    // Update driver's aggregate rating
    const driver = await prisma.driver.findUnique({ where: { id: ride.driverId } });
    if (driver) {
      const newCount = driver.reviewCount + 1;
      const newRating = ((driver.rating * driver.reviewCount) + rating) / newCount;
      await prisma.driver.update({
        where: { id: ride.driverId },
        data: { rating: Math.round(newRating * 10) / 10, reviewCount: newCount },
      });
    }

    res.status(201).json(review);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit review', message: err.message });
  }
});

// POST /api/v1/rides/:id/passenger-feedback — driver gives thumbs up/down to passenger
router.post('/:id/passenger-feedback', async (req, res) => {
  try {
    const { thumbsUp, comment } = req.body;
    if (typeof thumbsUp !== 'boolean') {
      res.status(400).json({ error: 'thumbsUp (boolean) is required' });
      return;
    }

    const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }
    if (ride.status !== 'COMPLETED') {
      res.status(409).json({ error: 'Can only give feedback on completed rides' });
      return;
    }
    if (!ride.driverId) {
      res.status(400).json({ error: 'No driver assigned to this ride' });
      return;
    }

    const existing = await prisma.passengerFeedback.findUnique({ where: { rideId: ride.id } });
    if (existing) {
      res.status(409).json({ error: 'Feedback already submitted for this ride' });
      return;
    }

    const feedback = await prisma.passengerFeedback.create({
      data: {
        rideId: ride.id,
        fromDriverId: ride.driverId,
        toPassengerId: ride.passengerId,
        thumbsUp,
        comment: comment || null,
      },
    });

    res.status(201).json(feedback);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to submit passenger feedback', message: err.message });
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
        reporterId: ride.passengerId,
        lat: lat || null,
        lng: lng || null,
        alertType: 'ADMIN_EMAIL',
        notes: description || 'Emergency triggered',
      },
    });

    res.status(201).json(event);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to trigger emergency', message: err.message });
  }
});

// POST /api/v1/rides/auto-cancel — cancel stale REQUESTED rides (cron or on-demand)
router.post('/auto-cancel', async (req, res) => {
  try {
    const timeoutMinutes = parseInt(req.body?.timeoutMinutes as string) || 5;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const staleRides = await prisma.ride.findMany({
      where: {
        status: 'REQUESTED',
        createdAt: { lt: cutoff },
      },
      select: { id: true, passengerId: true },
    });

    let cancelledCount = 0;
    for (const ride of staleRides) {
      await prisma.ride.update({
        where: { id: ride.id },
        data: { status: 'CANCELLED' },
      });
      await prisma.rideStatus.create({
        data: { rideId: ride.id, status: 'CANCELLED', actor: 'SYSTEM' },
      });
      await prisma.passenger.update({
        where: { id: ride.passengerId },
        data: { autoCancelledCount: { increment: 1 } },
      });
      cancelledCount++;
    }

    res.json({ cancelled: cancelledCount, cutoff });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to auto-cancel', message: err.message });
  }
});

export default router;
