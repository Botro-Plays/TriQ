import { Router } from 'express';
import { prisma } from '../lib/db';
import crypto from 'crypto';

const router = Router();

// PayMongo signature format: "t=TIMESTAMP,te=HMAC" (test) or "t=TIMESTAMP,li=HMAC" (live)
// HMAC is computed over `${timestamp}.${rawBody}` using the webhook secret
async function verifySignature(rawBody: string, signatureHeader: string): Promise<boolean> {
  const config = await prisma.systemConfig.findUnique({ where: { key: 'PAYMONGO_WEBHOOK_SECRET' } });
  const webhookSecret = config?.value || process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('[tipWebhook] No webhook secret configured — skipping signature verification');
    return true;
  }

  // Parse t=, te=, li= from header
  let timestamp = '';
  let sigHex = '';
  for (const part of signatureHeader.split(',')) {
    const [key, val] = part.split('=');
    if (key?.trim() === 't') timestamp = val?.trim() ?? '';
    if (key?.trim() === 'te' || key?.trim() === 'li') sigHex = val?.trim() ?? '';
  }

  if (!timestamp || !sigHex) {
    console.warn('[tipWebhook] Could not parse signature header:', signatureHeader);
    return false;
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
  return expected === sigHex;
}

// POST /api/v1/tips/webhook — PayMongo webhook (public, no auth)
// express.raw() is applied upstream so req.body is a Buffer with the raw bytes
router.post('/', async (req, res) => {
  try {
    // req.body is a Buffer from express.raw() upstream
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signatureHeader = req.headers['paymongo-signature'] as string || '';

    console.log('[tipWebhook] Received. Signature:', signatureHeader?.substring(0, 60));

    const valid = await verifySignature(rawBody, signatureHeader);
    if (!valid) {
      console.error('[tipWebhook] Invalid signature');
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    const event = JSON.parse(rawBody);

    // PayMongo event structure:
    // event.data.attributes.type  → e.g. "payment.paid"
    // event.data.attributes.data  → the payment/link object
    const eventAttrs = event?.data?.attributes;
    const eventType: string = eventAttrs?.type ?? '';
    const eventData = eventAttrs?.data;
    const paymentAttrs = eventData?.attributes ?? {};

    console.log('[tipWebhook] eventType:', eventType, '| paymentId:', eventData?.id);

    // ── payment.paid ─────────────────────────────────────────────────────────
    if (eventType === 'payment.paid') {
      const status: string = paymentAttrs.status ?? '';
      // payment_intent_id is how we match back to our checkout session
      const paymentIntentId: string = paymentAttrs.payment_intent_id ?? '';

      console.log('[tipWebhook] payment.paid — status:', status, '| payment_intent_id:', paymentIntentId);

      if (!paymentIntentId) {
        console.warn('[tipWebhook] payment.paid: no payment_intent_id — cannot match');
        res.json({ received: true, matched: false, reason: 'no_payment_intent_id' });
        return;
      }

      // Match tip
      const tip = await prisma.tip.findFirst({ where: { paymongoId: paymentIntentId } });
      if (tip) {
        if (status === 'paid' && tip.status !== 'PAID') {
          await prisma.tip.update({ where: { id: tip.id }, data: { status: 'PAID', paidAt: new Date() } });
          console.log('[tipWebhook] Tip', tip.id, 'marked PAID');
        }
        res.json({ received: true, type: 'tip', tipId: tip.id });
        return;
      }

      // Match subscription
      const subscription = await prisma.subscription.findFirst({ where: { paymongoId: paymentIntentId } });
      if (subscription) {
        if (status === 'paid' && subscription.status === 'PENDING') {
          await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'ACTIVE' } });
          await prisma.driver.update({
            where: { id: subscription.driverId },
            data: { subscriptionTier: subscription.tier, subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: subscription.expiresAt },
          });
          console.log('[tipWebhook] Subscription', subscription.id, 'activated for driver', subscription.driverId);
        }
        res.json({ received: true, type: 'subscription', subscriptionId: subscription.id });
        return;
      }

      console.warn('[tipWebhook] payment.paid: no tip or subscription matched payment_intent_id:', paymentIntentId);
      res.json({ received: true, matched: false });
      return;
    }

    // ── payment.failed ────────────────────────────────────────────────────────
    if (eventType === 'payment.failed') {
      const paymentIntentId: string = paymentAttrs.payment_intent_id ?? '';
      if (paymentIntentId) {
        const tip = await prisma.tip.findFirst({ where: { paymongoId: paymentIntentId } });
        if (tip && tip.status === 'PENDING') {
          await prisma.tip.update({ where: { id: tip.id }, data: { status: 'FAILED' } });
          console.log('[tipWebhook] Tip', tip.id, 'marked FAILED');
          res.json({ received: true, type: 'tip', tipId: tip.id });
          return;
        }
        const subscription = await prisma.subscription.findFirst({ where: { paymongoId: paymentIntentId } });
        if (subscription && subscription.status === 'PENDING') {
          await prisma.subscription.update({ where: { id: subscription.id }, data: { status: 'CANCELLED' } });
          console.log('[tipWebhook] Subscription', subscription.id, 'cancelled');
          res.json({ received: true, type: 'subscription', subscriptionId: subscription.id });
          return;
        }
      }
      res.json({ received: true, matched: false });
      return;
    }

    // ── qrph.expired / qr.expired / link.payment.paid — acknowledge only ─────
    console.log('[tipWebhook] Unhandled event type:', eventType);
    res.json({ received: true, eventType, matched: false });
  } catch (err: any) {
    console.error('[tipWebhook] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed', message: err.message });
  }
});

export default router;
