import type { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Idempotent database seed — safe to run on every server startup.
 * Uses upsert so existing data is never overwritten.
 */
export async function seedDatabase(prisma: PrismaClient) {
  // Seed Digos City
  const digos = await prisma.city.upsert({
    where: { id: 'digos-city-001' },
    update: {},
    create: {
      id: 'digos-city-001',
      name: 'Digos City',
      country: 'Philippines',
      province: 'Davao del Sur',
      lat: 6.7500,
      lng: 125.3573,
      isActive: true,
    },
  });

  // Seed Fare Rate for Digos City
  await prisma.fareRate.upsert({
    where: { id: 'fare-digos-001' },
    update: {},
    create: {
      id: 'fare-digos-001',
      cityId: digos.id,
      baseFare: 1600,      // ₱16 in centavos
      perKmRate: 1000,     // ₱10 per km in centavos
      maxDistance: 10,
      minDistance: 1,
    },
  });

  // Seed System Config defaults
  const configs = [
    { key: 'MAINTENANCE_MODE', value: 'false', description: 'Global maintenance mode' },
    { key: 'PASSENGER_BOOKING_ENABLED', value: 'true', description: 'Allow new passenger bookings' },
    { key: 'DRIVER_REGISTRATION_ENABLED', value: 'true', description: 'Allow new driver registrations' },
    { key: 'AUTO_CANCEL_MINUTES', value: '90', description: 'Minutes before auto-cancelling pending rides' },
  ];

  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { key: config.key },
      update: {},
      create: config,
    });
  }

  // Seed Owner account (rightful owner — must login with phone +639564805224 to claim)
  await prisma.user.upsert({
    where: { phoneNumber: '+639564805224' },
    update: {},
    create: {
      firebaseUid: 'OWNER_PENDING',
      email: 'aquariusbotro@gmail.com',
      phoneNumber: '+639564805224',
      role: 'OWNER',
    },
  });

  logger.log('✅ Seed complete');
}
