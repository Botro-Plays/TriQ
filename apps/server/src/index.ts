import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { setupSocketHandlers } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { requestLogger } from './middleware/requestLogger';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import passengerRoutes from './routes/passenger';
import driverRoutes from './routes/driver';
import rideRoutes from './routes/ride';
import tipRoutes from './routes/tip';
import adminRoutes from './routes/admin';
import reportRoutes from './routes/report';

// Load environment variables
const envPath = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
dotenv.config({ path: envPath });

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
app.use(helmet());
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

httpServer.listen(PORT, () => {
  console.log(`🛺 TriQ Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'not configured'}`);
  const webDistPath = path.resolve(__dirname, '../../web/dist');
  if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
    console.log(`🌐 Frontend PWA served at root /`);
  } else {
    console.log(`⚠️  Frontend PWA not built yet (run: npm run build -w apps/web)`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server...');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing server...');
  httpServer.close(() => {
    console.log('HTTP server closed');
  });
  await prisma.$disconnect();
  process.exit(0);
});
