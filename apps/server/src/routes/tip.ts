import { Router } from 'express';
import { prisma } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/tips — create platform tip (initiates PayMongo checkout)
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { passengerId, driverId, amount, rideId } = req.body;
    if (typeof amount !== 'number' || amount < 100) {
      res.status(400).json({ error: 'amount (min 100 centavos = ₱1) is required' });
      return;
    }

    // Resolve passengerId — from body or from auth user
    let resolvedPassengerId = passengerId;
    if (!resolvedPassengerId && req.user?.userId) {
      const passenger = await prisma.passenger.findUnique({ where: { userId: req.user.userId } });
      resolvedPassengerId = passenger?.id;
    }

    // Resolve driverId — from body or from auth user
    let resolvedDriverId = driverId;
    if (!resolvedDriverId && req.user?.userId) {
      const driver = await prisma.driver.findUnique({ where: { userId: req.user.userId } });
      resolvedDriverId = driver?.id;
    }

    if (!resolvedPassengerId && !resolvedDriverId) {
      res.status(400).json({ error: 'Could not determine user — provide passengerId or driverId' });
      return;
    }

    // Check SystemConfig first, then fall back to env var
    const paymongoConfig = await prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_SECRET_KEY' } });
    const PAYMONGO_SECRET = paymongoConfig?.value || process.env.PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET;
    if (!PAYMONGO_SECRET) {
      // Dev mode — create tip as PENDING without PayMongo
      const tip = await prisma.tip.create({
        data: {
          passengerId: resolvedPassengerId || null,
          driverId: resolvedDriverId || null,
          rideId: rideId || null,
          amount,
          status: 'PENDING',
        },
      });
      res.status(201).json({ tip, checkoutUrl: null, message: 'PayMongo not configured — tip created in PENDING state' });
      return;
    }

    // Create PayMongo checkout session
    const baseUrl = process.env.WEB_APP_URL || `https://${req.headers.host}`;
    const redirectBase = resolvedDriverId ? '/driver' : '/passenger';
    const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET).toString('base64')}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            description: 'TriQ Platform Tip',
            line_items: [
              {
                name: 'Platform Tip',
                amount,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: ['gcash', 'paymaya', 'card', 'qrph'],
            success_url: `${baseUrl}${redirectBase}?tip=success`,
            failed_url: `${baseUrl}${redirectBase}?tip=failed`,
          },
        },
      }),
    });

    const session = await response.json() as any;
    if (!response.ok) {
      console.error('[tip] PayMongo checkout error:', JSON.stringify(session));
      res.status(502).json({ error: 'PayMongo checkout creation failed', details: session });
      return;
    }

    const checkoutId = session.data.id;
    const checkoutUrl = session.data.attributes.checkout_url;
    // Store payment_intent_id — this is what the payment.paid webhook carries
    const paymentIntentId: string = session.data.attributes?.payment_intent?.id ?? checkoutId;

    const tip = await prisma.tip.create({
      data: {
        passengerId: resolvedPassengerId || null,
        driverId: resolvedDriverId || null,
        rideId: rideId || null,
        amount,
        status: 'PENDING',
        paymongoId: paymentIntentId,
      },
    });

    res.status(201).json({ tip, checkoutUrl });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create tip', message: err.message });
  }
});

// GET /api/v1/tips/:id/status — check tip payment status
router.get('/:id/status', async (req, res) => {
  try {
    const tip = await prisma.tip.findUnique({ where: { id: req.params.id } });
    if (!tip) {
      res.status(404).json({ error: 'Tip not found' });
      return;
    }
    res.json({ id: tip.id, status: tip.status, amount: tip.amount });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get tip status', message: err.message });
  }
});

export default router;
