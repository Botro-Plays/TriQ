import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

export const setupSocketHandlers = (io: Server, prisma: PrismaClient) => {
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Authenticate socket (Firebase token verification)
    socket.on('auth', async (data: { token: string; role: string }) => {
      // TODO: Verify Firebase token, join user-specific room
      console.log(`Auth attempt from ${socket.id}, role: ${data.role}`);
    });

    // Driver events
    socket.on('driver:online', async (data: { lat: number; lng: number; driverId: string }) => {
      // TODO: Update driver location, broadcast to nearby passengers
    });

    socket.on('driver:offline', async (data: { driverId: string }) => {
      // TODO: Set driver offline, remove from broadcast
    });

    socket.on('driver:ride:accept', async (data: { rideId: string; driverId: string }) => {
      // TODO: Accept ride, notify passenger, update ride status
    });

    socket.on('driver:ride:arrived', async (data: { rideId: string }) => {
      // TODO: Update ride status to ARRIVING
    });

    socket.on('driver:ride:started', async (data: { rideId: string }) => {
      // TODO: Update ride status to IN_PROGRESS
    });

    socket.on('driver:ride:completed', async (data: { rideId: string; finalFare?: number }) => {
      // TODO: Complete ride, trigger payment/tip flow
    });

    // Passenger events
    socket.on('passenger:ride:request', async (data) => {
      // TODO: Create ride, find nearby drivers, broadcast request
    });

    socket.on('passenger:ride:cancel', async (data: { rideId: string; reason: string }) => {
      // TODO: Cancel ride, notify driver if accepted
    });

    socket.on('passenger:counter-offer:accept', async (data: { rideId: string }) => {
      // TODO: Accept counter-offer, update ride with negotiatedFare
    });

    socket.on('passenger:counter-offer:reject', async (data: { rideId: string }) => {
      // TODO: Reject counter-offer, notify driver, ride stays available
    });

    // Location sharing (driver → passenger)
    socket.on('driver:location', async (data: { rideId: string; lat: number; lng: number }) => {
      // TODO: Broadcast driver location to passenger room
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });
};
