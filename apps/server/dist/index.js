"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables FIRST — before any imports that create PrismaClient
// __dirname in compiled CommonJS points to dist/, so go up one level to project root
const envPath = path_1.default.join(__dirname, '..', '.env');
if (process.env.NODE_ENV !== 'production') {
    console.log('🔧 Loading .env from:', envPath);
    console.log('🔧 __dirname:', __dirname);
}
const result = dotenv_1.default.config({ path: envPath });
if (result.error) {
    if (process.env.NODE_ENV !== 'production')
        console.error('❌ dotenv error:', result.error);
}
else {
    if (process.env.NODE_ENV !== 'production')
        console.log('✅ dotenv loaded, DATABASE_URL exists:', !!process.env.DATABASE_URL);
}
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const socket_1 = require("./socket");
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const requestLogger_1 = require("./middleware/requestLogger");
const logger_1 = require("./lib/logger");
const seed_1 = require("./lib/seed");
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const passenger_1 = __importDefault(require("./routes/passenger"));
const driver_1 = __importDefault(require("./routes/driver"));
const ride_1 = __importDefault(require("./routes/ride"));
const tip_1 = __importDefault(require("./routes/tip"));
const admin_1 = __importDefault(require("./routes/admin"));
const report_1 = __importDefault(require("./routes/report"));
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.WEB_APP_URL || 'http://localhost:5173',
        credentials: true,
    },
});
exports.prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
// Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP — may cause HTTP/2 proxy issues with HidenCloud
}));
app.use((0, cors_1.default)({
    origin: process.env.WEB_APP_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(requestLogger_1.requestLogger);
app.use(rateLimiter_1.rateLimiter);
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// API Routes
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/users', user_1.default);
app.use('/api/v1/passengers', passenger_1.default);
app.use('/api/v1/drivers', driver_1.default);
app.use('/api/v1/rides', ride_1.default);
app.use('/api/v1/tips', tip_1.default);
app.use('/api/v1/admin', admin_1.default);
app.use('/api/v1/reports', report_1.default);
// Socket.io
(0, socket_1.setupSocketHandlers)(io, exports.prisma);
// Error handling (must be last)
app.use(errorHandler_1.errorHandler);
// Serve built web app (PWA) static files
const webDistPath = path_1.default.resolve(__dirname, '../../web/dist');
if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
    // Use express.static with HTTP/2-compatible options
    app.use(express_1.default.static(webDistPath, {
        etag: false, // Disable ETag to avoid HTTP/2 proxy issues
        lastModified: false, // Disable Last-Modified to avoid HTTP/2 proxy issues
        maxAge: '1y', // Long cache for hashed assets
        setHeaders: (res) => {
            res.removeHeader('X-Powered-By');
        },
    }));
    // React Router catch-all: serve index.html for non-API routes
    app.get('*', (req, res) => {
        // Don't serve index.html for API routes
        if (req.path.startsWith('/api/')) {
            return res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist' });
        }
        res.sendFile(path_1.default.join(webDistPath, 'index.html'));
    });
}
else {
    // 404 handler (dev mode or web not built yet)
    app.use((_req, res) => {
        res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist' });
    });
}
const PORT = parseInt(process.env.PORT || '4000', 10);
// Start server after seeding database
(async () => {
    try {
        await (0, seed_1.seedDatabase)(exports.prisma);
    }
    catch (err) {
        logger_1.logger.error('❌ Seed failed:', err);
        // Continue starting server — don't block startup on seed errors
    }
    httpServer.listen(PORT, () => {
        logger_1.logger.log(`🛺 TriQ Server running on port ${PORT}`);
        logger_1.logger.log(`📡 Socket.io ready`);
        logger_1.logger.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'not configured'}`);
        const webDistPath = path_1.default.resolve(__dirname, '../../web/dist');
        if (process.env.NODE_ENV === 'production' && require('fs').existsSync(webDistPath)) {
            logger_1.logger.log(`🌐 Frontend PWA served at root /`);
        }
        else {
            logger_1.logger.log(`⚠️  Frontend PWA not built yet (run: npm run build -w apps/web)`);
        }
    });
})();
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.logger.log('SIGTERM received. Closing server...');
    httpServer.close(() => {
        logger_1.logger.log('HTTP server closed');
    });
    await exports.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    logger_1.logger.log('SIGINT received. Closing server...');
    httpServer.close(() => {
        logger_1.logger.log('HTTP server closed');
    });
    await exports.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map