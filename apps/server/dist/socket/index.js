"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = void 0;
const setupSocketHandlers = (io, prisma) => {
    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);
        // Authenticate socket (Firebase token verification)
        socket.on('auth', async (data) => {
            // TODO: Verify Firebase token, join user-specific room
            console.log(`Auth attempt from ${socket.id}, role: ${data.role}`);
        });
        // Driver events
        socket.on('driver:online', async (data) => {
            // TODO: Update driver location, broadcast to nearby passengers
        });
        socket.on('driver:offline', async (data) => {
            // TODO: Set driver offline, remove from broadcast
        });
        socket.on('driver:ride:accept', async (data) => {
            // TODO: Accept ride, notify passenger, update ride status
        });
        socket.on('driver:ride:arrived', async (data) => {
            // TODO: Update ride status to ARRIVING
        });
        socket.on('driver:ride:started', async (data) => {
            // TODO: Update ride status to IN_PROGRESS
        });
        socket.on('driver:ride:completed', async (data) => {
            // TODO: Complete ride, trigger payment/tip flow
        });
        // Passenger events
        socket.on('passenger:ride:request', async (data) => {
            // TODO: Create ride, find nearby drivers, broadcast request
        });
        socket.on('passenger:ride:cancel', async (data) => {
            // TODO: Cancel ride, notify driver if accepted
        });
        socket.on('passenger:counter-offer:accept', async (data) => {
            // TODO: Accept counter-offer, update ride with negotiatedFare
        });
        socket.on('passenger:counter-offer:reject', async (data) => {
            // TODO: Reject counter-offer, notify driver, ride stays available
        });
        // Location sharing (driver → passenger)
        socket.on('driver:location', async (data) => {
            // TODO: Broadcast driver location to passenger room
        });
        // Disconnect
        socket.on('disconnect', () => {
            console.log(`❌ Client disconnected: ${socket.id}`);
        });
    });
};
exports.setupSocketHandlers = setupSocketHandlers;
//# sourceMappingURL=index.js.map