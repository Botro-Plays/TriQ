import dotenv from 'dotenv';
import path from 'path';

// Load environment variables FIRST — before any imports that create PrismaClient
// __dirname in compiled CommonJS points to dist/, so go up one level to project root
const envPath = path.join(__dirname, '..', '.env');
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Loading .env from:', envPath);
  console.log('🔧 __dirname:', __dirname);
}
const result = dotenv.config({ path: envPath });
if (result.error) {
  if (process.env.NODE_ENV !== 'production') console.error('❌ dotenv error:', result.error);
} else {
  if (process.env.NODE_ENV !== 'production') console.log('✅ dotenv loaded, DATABASE_URL exists:', !!process.env.DATABASE_URL);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { authMiddleware, requireRole } from './middleware/auth';
import { logger } from './lib/logger';
import { seedDatabase } from './lib/seed';
import { startRideCron } from './lib/rideCron';
import { initFirebaseAdmin } from './lib/firebaseAdmin';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import passengerRoutes from './routes/passenger';
import driverRoutes from './routes/driver';
import rideRoutes from './routes/ride';
import tipRoutes from './routes/tip';
import tipWebhookRoutes from './routes/tipWebhook';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/report';
import leaderboardRoutes from './routes/leaderboard';
import subscriptionRoutes from './routes/subscription';
import gamificationRoutes from './routes/gamification';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_APP_URL || true,
    credentials: true,
  },
});

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Serve static files with default options — no custom headers
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
  app.use(express.static(webDistPath));
}

// Middleware (minimal to avoid HTTP/2 proxy issues)
app.use(cors({
  origin: process.env.WEB_APP_URL || true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes (auth routes don't need JWT — they issue it)
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', authMiddleware, userRoutes);
app.use('/api/v1/passengers', authMiddleware, passengerRoutes);
app.use('/api/v1/drivers', authMiddleware, driverRoutes);
app.use('/api/v1/rides', authMiddleware, rideRoutes);
// Webhook MUST be before auth-protected tips route — PayMongo sends no JWT
// Use express.raw so we can verify the HMAC signature over the original bytes
app.use('/api/v1/tips/webhook', express.raw({ type: 'application/json' }), tipWebhookRoutes);
app.use('/api/v1/tips', authMiddleware, tipRoutes);
app.use('/api/v1/admin', authMiddleware, requireRole('OWNER', 'STAFF'), adminRoutes);
app.use('/api/v1/reports', authMiddleware, reportRoutes);
app.use('/api/v1/leaderboards', authMiddleware, leaderboardRoutes);
app.use('/api/v1/subscriptions', authMiddleware, subscriptionRoutes);
app.use('/api/v1/gamification', authMiddleware, gamificationRoutes);

// Socket.io
setupSocketHandlers(io, prisma);

// Error handling (must be last)
app.use(errorHandler);

// React Router catch-all: serve index.html for non-API routes
if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
  app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist' });
    }
    res.sendFile(path.join(webDistPath, 'index.html'));
  });
} else {
  // 404 handler (dev mode or web not built yet)
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist' });
  });
}

const PORT = parseInt(process.env.PORT || '4000', 10);

// Start server after seeding database
(async () => {
  console.log('[TriQ Server] Starting server initialization...');
  console.log('[TriQ Server] PORT:', PORT, 'NODE_ENV:', process.env.NODE_ENV);

  try {
    console.log('[TriQ Server] Seeding database...');
    await seedDatabase(prisma);
    console.log('[TriQ Server] Database seed complete.');
  } catch (err) {
    console.error('[TriQ Server] ❌ Seed failed:', err);
    // Continue starting server — don't block startup on seed errors
  }

  initFirebaseAdmin();
  startRideCron();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[TriQ Server] 🛺 Server running on 0.0.0.0:${PORT}`);
    console.log(`[TriQ Server] 📡 Socket.io ready`);
    console.log(`[TriQ Server] 🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'not configured'}`);
    const webDistPath = path.resolve(__dirname, '../../web/dist');
    if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
      console.log(`[TriQ Server] 🌐 Frontend PWA served at root /`);
    } else {
      console.log(`[TriQ Server] ⚠️  Frontend PWA not built yet`);
    }
  });
})();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.log('SIGTERM received. Closing server...');
  httpServer.close(() => {
    logger.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.log('SIGINT received. Closing server...');
  httpServer.close(() => {
    logger.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});
