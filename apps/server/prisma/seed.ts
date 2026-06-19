import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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
      baseFare: 1600, // ₱16 in centavos
      perKmRate: 1000, // ₱10 per km in centavos
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

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
