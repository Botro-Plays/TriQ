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
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';
import { logger } from './lib/logger';
import { seedDatabase } from './lib/seed';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import passengerRoutes from './routes/passenger';
import driverRoutes from './routes/driver';
import rideRoutes from './routes/ride';
import tipRoutes from './routes/tip';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/report';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_APP_URL || 'http://localhost:5173',
    credentials: true,
  },
});

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Trust proxy (HidenCloud reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com", "https://www.gstatic.com", "https://*.firebaseio.com", "https://*.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "https://*.google.com", "https://*.gstatic.com"],
      connectSrc: ["'self'", "https://*.firebaseio.com", "https://*.googleapis.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://www.google.com"],
      frameSrc: ["'self'", "https://www.google.com", "https://*.firebaseapp.com"],
      frameAncestors: ["'self'", "https://www.google.com"],
      childSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(cors({
  origin: process.env.WEB_APP_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(requestLogger);
app.use(rateLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/passengers', passengerRoutes);
app.use('/api/v1/drivers', driverRoutes);
app.use('/api/v1/rides', rideRoutes);
app.use('/api/v1/tips', tipRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/reports', reportRoutes);

// Socket.io
setupSocketHandlers(io, prisma);

// Error handling (must be last)
app.use(errorHandler);

// Serve built web app (PWA) static files
const webDistPath = path.resolve(__dirname, '../../web/dist');
if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
  app.use(express.static(webDistPath));

  // React Router catch-all: serve index.html for non-API routes
  app.get('*', (_req, res) => {
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
  try {
    await seedDatabase(prisma);
  } catch (err) {
    logger.error('❌ Seed failed:', err);
    // Continue starting server — don't block startup on seed errors
  }

  httpServer.listen(PORT, () => {
    logger.log(`🛺 TriQ Server running on port ${PORT}`);
    logger.log(`📡 Socket.io ready`);
    logger.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'not configured'}`);
    const webDistPath = path.resolve(__dirname, '../../web/dist');
    if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
      logger.log(`🌐 Frontend PWA served at root /`);
    } else {
      logger.log(`⚠️  Frontend PWA not built yet (run: npm run build -w apps/web)`);
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
