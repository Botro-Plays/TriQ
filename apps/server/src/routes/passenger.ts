import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// GET /api/v1/passengers?userId=xxx — get passenger by user ID
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      res.status(400).json({ error: 'userId query param required' });
      return;
    }
    const passenger = await prisma.passenger.findUnique({
      where: { userId: userId as string },
      select: { id: true, name: true, photoUrl: true, kycStatus: true, trustScore: true },
    });
    if (!passenger) {
      res.status(404).json({ error: 'Passenger not found' });
      return;
    }
    res.json(passenger);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get passenger', message: err.message });
  }
});

// GET /api/v1/passengers/:id — get passenger profile
router.get('/:id', async (req, res) => {
  try {
    const passenger = await prisma.passenger.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        photoUrl: true,
        homeLocation: true,
        workLocation: true,
        emergencyContact: true,
        kycStatus: true,
        trustScore: true,
        autoCancelledCount: true,
      },
    });
    if (!passenger) {
      res.status(404).json({ error: 'Passenger not found' });
      return;
    }
    res.json(passenger);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get passenger', message: err.message });
  }
});

// GET /api/v1/passengers/:id/rides — ride history
router.get('/:id/rides', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const rides = await prisma.ride.findMany({
      where: { passengerId: req.params.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        dropoffAddress: true,
        pickupLat: true,
        pickupLng: true,
        dropoffLat: true,
        dropoffLng: true,
        estimatedFare: true,
        finalFare: true,
        createdAt: true,
        completedAt: true,
        driver: { select: { id: true, name: true, plateNumber: true, subscriptionStatus: true, subscriptionTier: true } },
        review: { select: { id: true, rating: true, thumbsUp: true, comment: true } },
      },
    });
    res.json({ rides, page });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get rides', message: err.message });
  }
});

// POST /api/v1/passengers/:id/places — save favorite place
router.post('/:id/places', async (req, res) => {
  try {
    const { label, address, lat, lng } = req.body;
    if (!label || !address || typeof lat !== 'number' || typeof lng !== 'number') {
      res.status(400).json({ error: 'label, address, lat, lng are required' });
      return;
    }
    const place = await prisma.savedPlace.create({
      data: { passengerId: req.params.id, label, address, lat, lng },
    });
    res.status(201).json(place);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save place', message: err.message });
  }
});

// GET /api/v1/passengers/:id/places — saved places
router.get('/:id/places', async (req, res) => {
  try {
    const places = await prisma.savedPlace.findMany({
      where: { passengerId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ places });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get places', message: err.message });
  }
});

export default router;
