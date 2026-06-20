"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebaseAdmin_1 = require("../lib/firebaseAdmin");
const db_1 = require("../lib/db");
const router = (0, express_1.Router)();
// Initialize Firebase Admin on first request
(0, firebaseAdmin_1.initFirebaseAdmin)();
// POST /api/v1/auth/verify-token — verify Firebase ID token, return TriQ JWT
router.post('/verify-token', async (req, res) => {
    try {
        const { idToken, role } = req.body;
        if (!idToken) {
            res.status(400).json({ error: 'idToken is required' });
            return;
        }
        let phoneNumber;
        let firebaseUid;
        let displayName;
        let email;
        try {
            const firebaseUser = await (0, firebaseAdmin_1.verifyFirebaseToken)(idToken);
            phoneNumber = firebaseUser.phone_number || req.body.phone;
            firebaseUid = firebaseUser.uid;
            displayName = firebaseUser.name || phoneNumber;
            email = firebaseUser.email || req.body.email;
        }
        catch (err) {
            console.warn('Firebase token verification failed:', err.message);
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Upsert user in our database
        let user = await db_1.prisma.user.findUnique({ where: { firebaseUid } });
        // Returning users don't need to re-provide phone number
        if (!user && !phoneNumber) {
            res.status(400).json({ error: 'Phone number required', code: 'PHONE_REQUIRED' });
            return;
        }
        // Account linking: if Google user provides phone already registered, link accounts
        if (!user && phoneNumber) {
            const existingByPhone = await db_1.prisma.user.findUnique({ where: { phoneNumber } });
            if (existingByPhone) {
                // Check if this is the seeded owner being claimed
                const isOwnerClaim = existingByPhone.role === 'OWNER' && existingByPhone.firebaseUid === 'OWNER_PENDING';
                const updateData = { firebaseUid };
                if (email)
                    updateData.email = email;
                user = await db_1.prisma.user.update({
                    where: { id: existingByPhone.id },
                    data: updateData,
                });
                console.log(`${isOwnerClaim ? 'Owner claimed' : 'Linked Google account'} ${firebaseUid} to user ${user.id}`);
            }
        }
        if (!user) {
            // This should not happen due to earlier check, but satisfies TS narrowing
            if (!phoneNumber) {
                res.status(400).json({ error: 'Phone number required', code: 'PHONE_REQUIRED' });
                return;
            }
            // Prevent anyone from creating a second OWNER
            if (role === 'OWNER') {
                const existingOwner = await db_1.prisma.user.findFirst({ where: { role: 'OWNER' } });
                if (existingOwner) {
                    res.status(403).json({ error: 'Owner account already exists', code: 'OWNER_EXISTS' });
                    return;
                }
            }
            const newRole = role === 'DRIVER' ? 'DRIVER' : role === 'OWNER' ? 'OWNER' : role === 'STAFF' ? 'STAFF' : 'PASSENGER';
            const createData = {
                firebaseUid,
                phoneNumber,
                role: newRole,
            };
            if (email)
                createData.email = email;
            user = await db_1.prisma.user.create({ data: createData });
            // Create Passenger or Driver profile
            if (newRole === 'PASSENGER') {
                await db_1.prisma.passenger.create({
                    data: { userId: user.id, name: displayName || phoneNumber },
                });
            }
            else if (newRole === 'DRIVER') {
                await db_1.prisma.driver.create({
                    data: { userId: user.id, name: displayName || phoneNumber, plateNumber: 'PENDING-' + Date.now() },
                });
            }
        }
        // Generate TriQ JWT
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role, phone: user.phoneNumber }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({
            token,
            user: {
                id: user.id,
                phoneNumber: user.phoneNumber,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (err) {
        console.error('Auth error:', err);
        res.status(500).json({ error: 'Authentication failed', message: err.message });
    }
});
// GET /api/v1/auth/owner-exists — check if owner account is already claimed
router.get('/owner-exists', async (_req, res) => {
    try {
        const owner = await db_1.prisma.user.findFirst({ where: { role: 'OWNER' } });
        // ownerClaimed = true when owner exists AND firebaseUid is not the pending placeholder
        const ownerClaimed = owner ? owner.firebaseUid !== 'OWNER_PENDING' : false;
        res.json({ ownerClaimed });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to check owner status' });
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
        const decoded = jsonwebtoken_1.default.verify(oldToken, process.env.JWT_SECRET || 'dev-secret', { ignoreExpiration: true });
        const user = await db_1.prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
        const token = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role, phone: user.phoneNumber }, jwtSecret, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
        res.json({ token, user: { id: user.id, phoneNumber: user.phoneNumber, role: user.role } });
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token', message: err.message });
    }
});
// POST /api/v1/auth/logout
router.post('/logout', (_req, res) => {
    // JWT is stateless; client just deletes the token
    res.json({ message: 'Logged out' });
});
exports.default = router;
//# sourceMappingURL=auth.js.map