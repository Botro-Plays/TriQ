import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { initFirebaseAdmin, verifyFirebaseToken } from '../lib/firebaseAdmin';
import { prisma } from '../lib/db';

const router = Router();

// Initialize Firebase Admin on first request
initFirebaseAdmin();

// POST /api/v1/auth/verify-token — verify Firebase ID token, return TriQ JWT
router.post('/verify-token', async (req, res) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }

    let phoneNumber: string;
    let firebaseUid: string;

    try {
      const firebaseUser = await verifyFirebaseToken(idToken);
      phoneNumber = firebaseUser.phone_number!;
      firebaseUid = firebaseUser.uid;
    } catch (err: any) {
      console.warn('Firebase token verification failed:', err.message);
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number not found' });
      return;
    }

    // Upsert user in our database
    let user = await prisma.user.findUnique({ where: { firebaseUid } });

    if (!user) {
      const newRole = role === 'DRIVER' ? 'DRIVER' : role === 'OWNER' ? 'OWNER' : role === 'STAFF' ? 'STAFF' : 'PASSENGER';
      user = await prisma.user.create({
        data: {
          firebaseUid,
          phoneNumber,
          role: newRole,
        },
      });

      // Create Passenger or Driver profile
      if (newRole === 'PASSENGER') {
        await prisma.passenger.create({
          data: { userId: user.id, name: phoneNumber },
        });
      } else if (newRole === 'DRIVER') {
        await prisma.driver.create({
          data: { userId: user.id, name: phoneNumber, plateNumber: 'PENDING-' + Date.now() },
        });
      }
    }

    // Generate TriQ JWT
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign(
      { userId: user.id, role: user.role, phone: user.phoneNumber },
      jwtSecret,
      { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error('Auth error:', err);
    res.status(500).json({ error: 'Authentication failed', message: err.message });
  }
});

// POST /api/v1/auth/refresh — refresh TriQ JWT
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const oldToken = authHeader.slice(7);
    const decoded = jwt.verify(oldToken, process.env.JWT_SECRET || 'dev-secret', { ignoreExpiration: true }) as any;

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
    const token = jwt.sign(
      { userId: user.id, role: user.role, phone: user.phoneNumber },
      jwtSecret,
      { expiresIn: (process.env.JWT_EXPIRES_IN as any) || '7d' }
    );

    res.json({ token, user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role } });
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid token', message: err.message });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', (_req, res) => {
  // JWT is stateless; client just deletes the token
  res.json({ message: 'Logged out' });
});

export default router;
