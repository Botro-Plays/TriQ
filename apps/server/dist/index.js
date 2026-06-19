"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const socket_1 = require("./socket");
const errorHandler_1 = require("./middleware/errorHandler");
const rateLimiter_1 = require("./middleware/rateLimiter");
const requestLogger_1 = require("./middleware/requestLogger");
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const passenger_1 = __importDefault(require("./routes/passenger"));
const driver_1 = __importDefault(require("./routes/driver"));
const ride_1 = __importDefault(require("./routes/ride"));
const tip_1 = __importDefault(require("./routes/tip"));
const admin_1 = __importDefault(require("./routes/admin"));
const report_1 = __importDefault(require("./routes/report"));
// Load environment variables
const envPath = process.env.NODE_ENV === 'production' ? '.env' : '.env.local';
dotenv_1.default.config({ path: envPath });
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
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.WEB_APP_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use((0, compression_1.default)());
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
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found', message: 'The requested resource does not exist' });
});
const PORT = parseInt(process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
    console.log(`🛺 TriQ Server running on port ${PORT}`);
    console.log(`📡 Socket.io ready`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'not configured'}`);
});
// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Closing server...');
    httpServer.close(() => {
        console.log('HTTP server closed');
    });
    await exports.prisma.$disconnect();
    process.exit(0);
});
process.on('SIGINT', async () => {
    console.log('SIGINT received. Closing server...');
    httpServer.close(() => {
        console.log('HTTP server closed');
    });
    await exports.prisma.$disconnect();
    process.exit(0);
});
//# sourceMappingURL=index.js.map