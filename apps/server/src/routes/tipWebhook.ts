import { Router } from 'express';
import { prisma } from '../lib/db';

const router = Router();

// POST /api/v1/tips/webhook — PayMongo webhook (public, no auth)
router.post('/', async (req, res) => {
  try {
    const event = req.body;

    // PayMongo sends event.data.attributes with payment details
    const attrs = event?.data?.attributes;
    if (!attrs) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    const status = attrs.status;
    const referenceNumber = attrs.reference_number || attrs.id;

    // Find tip by paymongoId or reference
    const tip = await prisma.tip.findFirst({
      where: { paymongoId: referenceNumber },
    });

    if (!tip) {
      res.status(404).json({ error: 'Tip not found for this reference' });
      return;
    }

    if (status === 'paid' && tip.status !== 'PAID') {
      await prisma.tip.update({
        where: { id: tip.id },
        data: { status: 'PAID' },
      });
    } else if (status === 'failed' && tip.status === 'PENDING') {
      await prisma.tip.update({
        where: { id: tip.id },
        data: { status: 'FAILED' },
      });
    }

    res.json({ received: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Webhook processing failed', message: err.message });
  }
});

export default router;
