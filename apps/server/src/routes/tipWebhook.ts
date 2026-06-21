import { Router } from 'express';
import { prisma } from '../lib/db';
import crypto from 'crypto';

const router = Router();

// Verify PayMongo webhook signature
async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_WEBHOOK_SECRET' } });
  const webhookSecret = config?.value || process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) return true; // Skip verification if not configured (dev mode)

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  return expected === signature;
}

// POST /api/v1/tips/webhook — PayMongo webhook (public, no auth)
router.post('/', async (req, res) => {
  try {
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const signature = req.headers['paymongo-signature'] as string || '';

    const valid = await verifySignature(rawBody, signature);
    if (!valid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event = req.body;

    // PayMongo sends event.data.attributes with payment details
    const attrs = event?.data?.attributes;
    if (!attrs) {
      res.status(400).json({ error: 'Invalid webhook payload' });
      return;
    }

    const status = attrs.status;
    const referenceNumber = attrs.reference_number || attrs.id;
    const eventType = event?.data?.type || '';

    // Try to find a tip by paymongoId
    const tip = await prisma.tip.findFirst({
      where: { paymongoId: referenceNumber },
    });

    if (tip) {
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
      res.json({ received: true, type: 'tip' });
      return;
    }

    // Try to find a subscription by paymongoId
    const subscription = await prisma.subscription.findFirst({
      where: { paymongoId: referenceNumber },
    });

    if (subscription) {
      if (status === 'paid' && subscription.status === 'PENDING') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'ACTIVE' },
        });

        // Update driver's subscription fields
        await prisma.driver.update({
          where: { id: subscription.driverId },
          data: {
            subscriptionTier: 'PRO',
            subscriptionStatus: 'ACTIVE',
            subscriptionExpiresAt: subscription.expiresAt,
          },
        });
      } else if (status === 'failed' && subscription.status === 'PENDING') {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELLED' },
        });
      }
      res.json({ received: true, type: 'subscription' });
      return;
    }

    // No matching record found — still return 200 so PayMongo doesn't retry
    res.json({ received: true, matched: false });
  } catch (err: any) {
    res.status(500).json({ error: 'Webhook processing failed', message: err.message });
  }
});

export default router;
