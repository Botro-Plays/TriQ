import { Router } from 'express';
import { prisma } from '../lib/db';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/subscriptions/checkout — initiate PayMongo checkout for PRO or ELITE subscription
router.post('/checkout', async (req: AuthRequest, res) => {
  try {
    const { driverId, tier = 'PRO' } = req.body;
    if (!driverId) {
      res.status(400).json({ error: 'driverId is required' });
      return;
    }
    if (tier !== 'PRO' && tier !== 'ELITE') {
      res.status(400).json({ error: 'tier must be PRO or ELITE' });
      return;
    }

    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      res.status(404).json({ error: 'Driver not found' });
      return;
    }

    // Read prices from SystemConfig (set by admin)
    const [proConfig, eliteConfig] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_PRO_PRICE' } }),
      prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_ELITE_PRICE' } }),
    ]);
    const PRO_PRICE_CENTAVOS = proConfig?.value ? parseInt(proConfig.value, 10) : 5000;
    const ELITE_PRICE_CENTAVOS = eliteConfig?.value ? parseInt(eliteConfig.value, 10) : 9900;
    const PRICE_CENTAVOS = tier === 'ELITE' ? ELITE_PRICE_CENTAVOS : PRO_PRICE_CENTAVOS;
    const TIER_LABEL = tier === 'ELITE' ? 'TriQ Elite' : 'TriQ Pro';

    // Check SystemConfig first, then fall back to env var
    const paymongoConfig = await prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_SECRET_KEY' } });
    const PAYMONGO_SECRET = paymongoConfig?.value || process.env.PAYMONGO_SECRET_KEY || process.env.PAYMONGO_SECRET;
    if (!PAYMONGO_SECRET) {
      // Dev mode — create trial subscription without PayMongo
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const sub = await prisma.subscription.create({
        data: {
          driverId,
          tier,
          status: 'ACTIVE',
          amount: PRICE_CENTAVOS,
          startedAt: new Date(),
          expiresAt,
        },
      });

      await prisma.driver.update({
        where: { id: driverId },
        data: {
          subscriptionTier: tier,
          subscriptionStatus: 'ACTIVE',
          subscriptionExpiresAt: expiresAt,
        },
      });

      res.status(201).json({ subscription: sub, checkoutUrl: null, message: 'PayMongo not configured — subscription activated in dev mode' });
      return;
    }

    const baseUrl = process.env.WEB_APP_URL || `https://${req.headers.host}`;
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
            description: `${TIER_LABEL} Subscription — Monthly`,
            line_items: [
              {
                name: `${TIER_LABEL} (1 month)`,
                amount: PRICE_CENTAVOS,
                currency: 'PHP',
                quantity: 1,
              },
            ],
            payment_method_types: ['gcash', 'paymaya', 'card', 'qrph'],
            success_url: `${baseUrl}/driver?subscription=success`,
            failed_url: `${baseUrl}/driver?subscription=failed`,
          },
        },
      }),
    });

    const session = await response.json() as any;
    if (!response.ok) {
      console.error('[subscription] PayMongo checkout error:', JSON.stringify(session));
      res.status(502).json({ error: 'PayMongo checkout creation failed', details: session });
      return;
    }

    const checkoutId = session.data.id;
    const checkoutUrl = session.data.attributes.checkout_url;
    // Store payment_intent_id — this is what the payment.paid webhook carries
    const paymentIntentId: string = session.data.attributes?.payment_intent?.id ?? checkoutId;

    // Create pending subscription — will be activated by webhook when payment is confirmed
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const sub = await prisma.subscription.create({
      data: {
        driverId,
        tier,
        status: 'PENDING',
        amount: PRICE_CENTAVOS,
        paymongoId: paymentIntentId,
        startedAt: new Date(),
        expiresAt,
      },
    });

    // Don't update driver's subscription fields yet — wait for webhook confirmation

    res.status(201).json({ subscription: sub, checkoutUrl });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create subscription checkout', message: err.message });
  }
});

// GET /api/v1/subscriptions/price — return current PRO and ELITE subscription prices
router.get('/price', async (_req, res) => {
  try {
    const [proConfig, eliteConfig] = await Promise.all([
      prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_PRO_PRICE' } }),
      prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_ELITE_PRICE' } }),
    ]);
    const proCentavos = proConfig?.value ? parseInt(proConfig.value, 10) : 5000;
    const eliteCentavos = eliteConfig?.value ? parseInt(eliteConfig.value, 10) : 9900;
    res.json({
      pro: { centavos: proCentavos, php: proCentavos / 100 },
      elite: { centavos: eliteCentavos, php: eliteCentavos / 100 },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get price', message: err.message });
  }
});

// GET /api/v1/subscriptions/:driverId — get current subscription status
router.get('/:driverId', async (req, res) => {
  try {
    const subs = await prisma.subscription.findMany({
      where: { driverId: req.params.driverId },
      orderBy: { startedAt: 'desc' },
      take: 5,
    });
    res.json({ subscriptions: subs });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get subscriptions', message: err.message });
  }
});

export default router;
