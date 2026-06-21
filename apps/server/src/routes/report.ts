import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// POST /api/v1/reports — create report
router.post('/', async (req, res) => {
  try {
    const { rideId, category, description, reporterId, reportedId, reporterRole, reportedRole } = req.body;
    if (!rideId || !category) {
      res.status(400).json({ error: 'rideId and category are required' });
      return;
    }

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) {
      res.status(404).json({ error: 'Ride not found' });
      return;
    }

    const severity = ['Harassment'].includes(category) ? 'HIGH'
      : ['Unsafe driving', 'No-show / abandoned ride'].includes(category) ? 'MEDIUM'
      : 'LOW';

    const report = await prisma.report.create({
      data: {
        rideId,
        reporterId: reporterId || ride.passengerId,
        reportedId: reportedId || ride.driverId || '',
        reporterRole: (reporterRole as any) || 'PASSENGER',
        reportedRole: (reportedRole as any) || 'DRIVER',
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

// GET /api/v1/reports/:id — get report details
router.get('/:id', async (req, res) => {
  try {
    const report = await prisma.report.findUnique({
      where: { id: req.params.id },
      include: { ride: true, attachments: true },
    });
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get report', message: err.message });
  }
});

export default router;
