# TriQ — Testing Strategy

## Test Pyramid

```
       /\
      /  \   E2E Tests (Playwright) — ~10%
     /    \  Critical user journeys
    /------\ 
   /        \  Integration Tests (Jest + Supertest) — ~30%
  /          \ API endpoints, DB queries, Socket.io
 /------------\
/              \ Unit Tests (Jest + Vitest) — ~60%
/                \ Functions, utilities, Zod schemas
```

## Frameworks

| Layer | Framework | Rationale |
|-------|-----------|-----------|
| Unit | **Jest** (backend), **Vitest** (frontend) | Fast, TypeScript-native, good mocking |
| Integration | **Jest + Supertest** | HTTP assertions against running Express server |
| E2E | **Playwright** | Cross-browser, mobile viewport, PWA testing |
| DB Testing | **Prisma Test Client** | Isolated test DB per test run |
| Mobile | **Maestro** (optional Phase 2) | React Native E2E without flaky selectors |

## Coverage Targets

| Layer | Target |
|-------|--------|
| Unit | >= 80% |
| Integration | >= 60% |
| E2E | All critical paths covered |

---

## Unit Testing

### Backend Unit Tests (`backend/src/**/*.test.ts`)

```typescript
// Example: fare calculation utility
import { calculateFare } from '../utils/fare';

describe('calculateFare', () => {
  it('calculates base fare for short distance', () => {
    const result = calculateFare({ 
      baseFare: 1500, 
      perKmRate: 1000, 
      distanceKm: 0.5 
    });
    expect(result).toBe(1500); // baseFare only (distance < 1km)
  });

  it('calculates fare for 2km ride', () => {
    const result = calculateFare({ 
      baseFare: 1500, 
      perKmRate: 1000, 
      distanceKm: 2.0 
    });
    expect(result).toBe(2500); // 1500 + (1.0 * 1000)
  });

  it('rejects rides over max distance', () => {
    expect(() => calculateFare({ distanceKm: 15 }))
      .toThrow('Max distance exceeded');
  });
});
```

### Frontend Unit Tests (`apps/*/src/**/*.test.tsx`)

```typescript
// Example: fare display component
import { render, screen } from '@testing-library/react';
import { FareDisplay } from './FareDisplay';

describe('FareDisplay', () => {
  it('formats centavos to pesos', () => {
    render(<FareDisplay amount={2500} />);
    expect(screen.getByText('P25.00')).toBeInTheDocument();
  });
});
```

---

## Integration Testing

### Setup

```typescript
// tests/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$connect();
  // Run migrations on test database
});

afterAll(async () => {
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up test data
  await prisma.ride.deleteMany();
  await prisma.passenger.deleteMany();
  await prisma.driver.deleteMany();
});
```

### API Integration Test

```typescript
// tests/rides.test.ts
import request from 'supertest';
import { app } from '../src/app';
import { seedTestData } from './helpers';

describe('POST /api/v1/rides', () => {
  it('creates a ride request for verified passenger', async () => {
    const { passengerToken } = await seedTestData({ 
      kycStatus: 'VERIFIED' 
    });
    
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({
        pickupLat: 6.7500,
        pickupLng: 125.3573,
        pickupAddress: 'Test Pickup',
        dropoffLat: 6.7600,
        dropoffLng: 125.3700,
        dropoffAddress: 'Test Dropoff',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('REQUESTED');
    expect(res.body.data.estimatedFare).toBeGreaterThan(0);
  });

  it('rejects ride request for unverified passenger', async () => {
    const { passengerToken } = await seedTestData({ 
      kycStatus: 'UNVERIFIED' 
    });
    
    const res = await request(app)
      .post('/api/v1/rides')
      .set('Authorization', `Bearer ${passengerToken}`)
      .send({ pickupLat: 6.75, pickupLng: 125.36 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
```

### Socket.io Integration Test

```typescript
// tests/socket.test.ts
import { io, Socket } from 'socket.io-client';

describe('Socket.io Ride Flow', () => {
  let passengerSocket: Socket;
  let driverSocket: Socket;

  beforeEach(async () => {
    passengerSocket = io('http://localhost:4000', { 
      auth: { token: passengerToken } 
    });
    driverSocket = io('http://localhost:4000', { 
      auth: { token: driverToken } 
    });
    
    await Promise.all([
      new Promise(r => passengerSocket.on('connect', r)),
      new Promise(r => driverSocket.on('connect', r)),
    ]);
  });

  it('passenger requests ride, driver accepts', (done) => {
    driverSocket.on('ride:request', (ride) => {
      driverSocket.emit('driver:ride:accept', { rideId: ride.id });
    });

    passengerSocket.on('ride:status', (update) => {
      if (update.status === 'ACCEPTED') {
        expect(update.driver.id).toBeDefined();
        done();
      }
    });

    passengerSocket.emit('ride:request', ridePayload);
  });
});
```

---

## E2E Testing

### Critical Paths to Cover

1. **Passenger Journey**: Register -> OTP -> KYC upload -> Book ride -> Track driver -> Rate -> Tip
2. **Driver Journey**: Register -> OTP -> KYC upload -> Go online -> Accept ride -> Complete -> View earnings
3. **Admin Journey**: Login -> Review driver KYC -> Approve -> Monitor live map -> Resolve report
4. **Web PWA**: Open browser -> Book ride without app install -> Complete ride

### Playwright Example

```typescript
// e2e/passenger-booking.spec.ts
import { test, expect } from '@playwright/test';

test('passenger books a ride', async ({ page }) => {
  await page.goto('/');
  
  // Login with test phone
  await page.fill('[data-testid="phone-input"]', '+639171234567');
  await page.click('[data-testid="send-otp"]');
  // In test env, OTP is always "123456"
  await page.fill('[data-testid="otp-input"]', '123456');
  await page.click('[data-testid="verify-otp"]');
  
  // KYC flow (if not done)
  if (await page.isVisible('[data-testid="kyc-banner"]')) {
    // Upload test ID
  }
  
  // Book ride
  await page.click('[data-testid="set-pickup"]');
  await page.click('[data-testid="set-destination"]');
  await page.click('[data-testid="book-ride"]');
  
  // Wait for driver acceptance
  await expect(page.locator('[data-testid="ride-status"]'))
    .toHaveText('Driver on the way');
});
```

---

## Test Data & Seeding

### Test Phone Numbers (Firebase Auth Emulator)

| Phone | OTP | Role |
|-------|-----|------|
| +639171111111 | 123456 | Passenger (verified KYC) |
| +639172222222 | 123456 | Passenger (unverified) |
| +639173333333 | 123456 | Driver (verified KYC, online) |
| +639174444444 | 123456 | Driver (verified KYC, offline) |
| +639175555555 | 123456 | Admin |

### Database Seed Script

```typescript
// tests/seed.ts
export async function seedTestData(opts: { 
  kycStatus?: string;
  role?: string;
}) {
  // Create Firebase Auth user (emulator)
  // Create User + Passenger/Driver in test DB
  // Return auth tokens for testing
}
```

---

## Test Commands

```bash
# Unit tests
npm run test:unit

# Unit tests with coverage
npm run test:unit -- --coverage

# Integration tests (requires test DB + Redis)
npm run test:integration

# E2E tests (requires full stack running)
npm run test:e2e

# All tests
npm run test:all

# Watch mode
npm run test:unit -- --watch
```
