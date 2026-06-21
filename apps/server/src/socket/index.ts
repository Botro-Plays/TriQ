import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket {
  userId?: string;
  role?: string;
  driverId?: string;
  passengerId?: string;
}

const socketMap = new Map<string, AuthenticatedSocket>();

export const setupSocketHandlers = (io: Server, prisma: PrismaClient) => {
  // Auth middleware for socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret') as any;
      (socket as any).userId = decoded.userId;
      (socket as any).role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = (socket as any).userId as string;
    const role = (socket as any).role as string;
    console.log(`🔌 Client connected: ${socket.id} (user: ${userId}, role: ${role})`);

    socketMap.set(socket.id, { userId, role });
    socket.join(`user:${userId}`);

    // Driver events
    socket.on('driver:online', async (data: { lat: number; lng: number; driverId: string }) => {
      try {
        await prisma.driver.update({
          where: { id: data.driverId },
          data: { isOnline: true, currentLat: data.lat, currentLng: data.lng },
        });
        (socket as any).driverId = data.driverId;
        socket.join(`driver:${data.driverId}`);
        socketMap.get(socket.id)!.driverId = data.driverId;
      } catch (err) {
        console.error('driver:online error:', err);
      }
    });

    socket.on('driver:offline', async (data: { driverId: string }) => {
      try {
        await prisma.driver.update({
          where: { id: data.driverId },
          data: { isOnline: false },
        });
        socket.leave(`driver:${data.driverId}`);
      } catch (err) {
        console.error('driver:offline error:', err);
      }
    });

    socket.on('driver:location', async (data: { rideId: string; lat: number; lng: number }) => {
      try {
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          select: { passengerId: true },
        });
        if (ride) {
          const passenger = await prisma.passenger.findUnique({
            where: { id: ride.passengerId },
            select: { userId: true },
          });
          if (passenger) {
            io.to(`user:${passenger.userId}`).emit('driver:location', {
              rideId: data.rideId,
              lat: data.lat,
              lng: data.lng,
            });
          }
        }
      } catch (err) {
        console.error('driver:location error:', err);
      }
    });

    // Passenger events
    socket.on('passenger:ride:request', async (data: { rideId: string }) => {
      try {
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          select: { pickupLat: true, pickupLng: true, pickupAddress: true, dropoffAddress: true, estimatedFare: true, passengerCount: true, preferredDriverId: true },
        });
        if (ride) {
          if (ride.preferredDriverId) {
            const driver = await prisma.driver.findUnique({
              where: { id: ride.preferredDriverId },
              select: { userId: true },
            });
            if (driver) {
              io.to(`user:${driver.userId}`).emit('ride:request', { rideId: data.rideId, ...ride });
            }
          } else {
            io.emit('ride:request', { rideId: data.rideId, ...ride });
          }
        }
      } catch (err) {
        console.error('passenger:ride:request error:', err);
      }
    });

    socket.on('passenger:ride:cancel', async (data: { rideId: string; reason: string }) => {
      try {
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          select: { driverId: true },
        });
        if (ride?.driverId) {
          const driver = await prisma.driver.findUnique({
            where: { id: ride.driverId },
            select: { userId: true },
          });
          if (driver) {
            io.to(`user:${driver.userId}`).emit('ride:cancelled', { rideId: data.rideId, reason: data.reason });
          }
        }
      } catch (err) {
        console.error('passenger:ride:cancel error:', err);
      }
    });

    socket.on('passenger:counter-offer:accept', async (data: { rideId: string }) => {
      try {
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          select: { counterOfferDriverId: true },
        });
        if (ride?.counterOfferDriverId) {
          const driver = await prisma.driver.findUnique({
            where: { id: ride.counterOfferDriverId },
            select: { userId: true },
          });
          if (driver) {
            io.to(`user:${driver.userId}`).emit('counter-offer:accepted', { rideId: data.rideId });
          }
        }
      } catch (err) {
        console.error('passenger:counter-offer:accept error:', err);
      }
    });

    socket.on('passenger:counter-offer:reject', async (data: { rideId: string }) => {
      try {
        const ride = await prisma.ride.findUnique({
          where: { id: data.rideId },
          select: { counterOfferDriverId: true },
        });
        if (ride?.counterOfferDriverId) {
          const driver = await prisma.driver.findUnique({
            where: { id: ride.counterOfferDriverId },
            select: { userId: true },
          });
          if (driver) {
            io.to(`user:${driver.userId}`).emit('counter-offer:rejected', { rideId: data.rideId });
          }
        }
      } catch (err) {
        console.error('passenger:counter-offer:reject error:', err);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const info = socketMap.get(socket.id);
      if (info?.driverId) {
        prisma.driver.update({
          where: { id: info.driverId },
          data: { isOnline: false },
        }).catch(() => {});
      }
      socketMap.delete(socket.id);
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};

// Export helper to emit events from route handlers
export const emitToUser = (io: Server, userId: string, event: string, data: any) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitRideEvent = async (io: Server, prisma: PrismaClient, rideId: string, event: string, data: any) => {
  try {
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { passengerId: true, driverId: true },
    });
    if (!ride) return;

    const passenger = await prisma.passenger.findUnique({
      where: { id: ride.passengerId },
      select: { userId: true },
    });
    if (passenger) {
      io.to(`user:${passenger.userId}`).emit(event, data);
    }

    if (ride.driverId) {
      const driver = await prisma.driver.findUnique({
        where: { id: ride.driverId },
        select: { userId: true },
      });
      if (driver) {
        io.to(`user:${driver.userId}`).emit(event, data);
      }
    }
  } catch (err) {
    console.error('emitRideEvent error:', err);
  }
};
