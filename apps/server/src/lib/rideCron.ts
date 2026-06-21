import cron from 'node-cron';
import { prisma } from './db';
import { sendPush } from './fcm';

// Thresholds
const PENDING_WARN_MINUTES = 10;    // Ride not accepted after 10 min → warn passenger
const ACCEPTED_WARN_MINUTES = 45;   // Ride accepted but not started after 45 min → warn both
const IN_PROGRESS_WARN_HOURS = 2;   // Ride in progress > 2 hours → warn both

export function startRideCron() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();

      // ── 1. Pending rides not yet accepted ─────────────────────────────────
      const pendingCutoff = new Date(now.getTime() - PENDING_WARN_MINUTES * 60 * 1000);
      const pendingRides = await prisma.ride.findMany({
        where: {
          status: 'REQUESTED',
          createdAt: { lt: pendingCutoff },
          // Only notify once — use updatedAt trick: if updatedAt is very close to createdAt
          // we haven't nudged yet. We tag it by bumping updatedAt after notifying.
          // Simple approach: check if notifiedPending flag exists — we'll use a DB-less approach:
          // send if (now - createdAt) is between WARN and WARN+5 min window so we only fire once.
          AND: [
            { createdAt: { lt: pendingCutoff } },
            { createdAt: { gte: new Date(pendingCutoff.getTime() - 5 * 60 * 1000) } },
          ],
        },
        select: { id: true, passengerId: true },
      });

      for (const ride of pendingRides) {
        if (!ride.passengerId) continue;
        const pass = await prisma.passenger.findUnique({
          where: { id: ride.passengerId },
          select: { fcmToken: true } as any,
        }) as any;
        if (pass?.fcmToken) {
          await sendPush(pass.fcmToken, {
            title: '⏳ Still Looking for a Driver',
            body: `Your ride request hasn't been accepted yet. Hang tight or try cancelling and rebooking.`,
            data: { rideId: ride.id, type: 'PENDING_REMINDER' },
          });
        }
      }

      // ── 2. Accepted/arriving rides not started after 45 min ───────────────
      const acceptedCutoff = new Date(now.getTime() - ACCEPTED_WARN_MINUTES * 60 * 1000);
      const acceptedWindow = new Date(acceptedCutoff.getTime() - 5 * 60 * 1000);
      const stuckAccepted = await prisma.ride.findMany({
        where: {
          status: { in: ['ACCEPTED', 'ARRIVING', 'COUNTER_OFFER_ACCEPTED'] },
          updatedAt: { lt: acceptedCutoff, gte: acceptedWindow },
        },
        select: { id: true, passengerId: true, driverId: true },
      });

      for (const ride of stuckAccepted) {
        // Notify passenger
        if (ride.passengerId) {
          const pass = await prisma.passenger.findUnique({
            where: { id: ride.passengerId },
            select: { fcmToken: true } as any,
          }) as any;
          if (pass?.fcmToken) {
            await sendPush(pass.fcmToken, {
              title: '⚠️ Ride Delay',
              body: 'Your driver has been assigned but the ride hasn\'t started yet. Please check if they\'ve arrived.',
              data: { rideId: ride.id, type: 'DELAY_REMINDER' },
            });
          }
        }
        // Notify driver
        if (ride.driverId) {
          const drv = await prisma.driver.findUnique({
            where: { id: ride.driverId },
            select: { fcmToken: true } as any,
          }) as any;
          if (drv?.fcmToken) {
            await sendPush(drv.fcmToken, {
              title: '⚠️ Ride Reminder',
              body: 'You have an accepted ride that hasn\'t started yet. Please proceed to the passenger.',
              data: { rideId: ride.id, type: 'DELAY_REMINDER' },
            });
          }
        }
      }

      // ── 3. In-progress rides running too long (> 2 hours) ─────────────────
      const inProgressCutoff = new Date(now.getTime() - IN_PROGRESS_WARN_HOURS * 60 * 60 * 1000);
      const inProgressWindow = new Date(inProgressCutoff.getTime() - 5 * 60 * 1000);
      const longRides = await prisma.ride.findMany({
        where: {
          status: 'IN_PROGRESS',
          startedAt: { lt: inProgressCutoff, gte: inProgressWindow },
        },
        select: { id: true, passengerId: true, driverId: true },
      });

      for (const ride of longRides) {
        if (ride.passengerId) {
          const pass = await prisma.passenger.findUnique({
            where: { id: ride.passengerId },
            select: { fcmToken: true } as any,
          }) as any;
          if (pass?.fcmToken) {
            await sendPush(pass.fcmToken, {
              title: '🕐 Long Ride Alert',
              body: 'Your ride has been going for over 2 hours. Is everything okay?',
              data: { rideId: ride.id, type: 'LONG_RIDE' },
            });
          }
        }
        if (ride.driverId) {
          const drv = await prisma.driver.findUnique({
            where: { id: ride.driverId },
            select: { fcmToken: true } as any,
          }) as any;
          if (drv?.fcmToken) {
            await sendPush(drv.fcmToken, {
              title: '🕐 Long Ride Alert',
              body: 'This ride has been in progress for over 2 hours. Remember to complete the ride when done.',
              data: { rideId: ride.id, type: 'LONG_RIDE' },
            });
          }
        }
      }

      if (pendingRides.length || stuckAccepted.length || longRides.length) {
        console.log(`[rideCron] Sent reminders — pending:${pendingRides.length} stuck:${stuckAccepted.length} long:${longRides.length}`);
      }

      // ── 4. Auto-expire subscriptions ─────────────────────────────────────
      const expiredDrivers = await prisma.driver.findMany({
        where: {
          subscriptionStatus: 'ACTIVE',
          subscriptionTier: { not: 'FREE' as any },
          subscriptionExpiresAt: { lt: now },
        },
        select: { id: true, name: true },
      });

      for (const drv of expiredDrivers) {
        await prisma.driver.update({
          where: { id: drv.id },
          data: { subscriptionTier: 'FREE' as any, subscriptionStatus: 'ACTIVE', subscriptionExpiresAt: null },
        });
        // Also expire active Subscription records for this driver
        await prisma.subscription.updateMany({
          where: { driverId: drv.id, status: 'ACTIVE' },
          data: { status: 'EXPIRED' },
        });
        console.log(`[rideCron] Subscription expired for driver: ${drv.name}`);
      }

      if (expiredDrivers.length) {
        console.log(`[rideCron] Expired ${expiredDrivers.length} subscription(s)`);
      }
    } catch (err: any) {
      console.error('[rideCron] Error:', err?.message);
    }
  });

  console.log('[rideCron] ⏰ Ride reminder cron started (every 5 min)');
}
