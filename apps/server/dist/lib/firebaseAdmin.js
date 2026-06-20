"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
exports.initFirebaseAdmin = initFirebaseAdmin;
exports.verifyFirebaseToken = verifyFirebaseToken;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
const fs_1 = __importDefault(require("fs"));
let initialized = false;
function initFirebaseAdmin() {
    if (initialized)
        return firebase_admin_1.default;
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (serviceAccountPath && fs_1.default.existsSync(serviceAccountPath)) {
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccountPath),
            projectId,
        });
        initialized = true;
        console.log('🔥 Firebase Admin initialized from service account');
    }
    else if (projectId) {
        // Try application default credentials (works on GCP, may fail elsewhere)
        try {
            firebase_admin_1.default.initializeApp({ projectId });
            initialized = true;
            console.log('🔥 Firebase Admin initialized with projectId');
        }
        catch {
            console.warn('⚠️  Firebase Admin not initialized: no service account and no ADC');
        }
    }
    else {
        console.warn('⚠️  Firebase Admin not initialized: FIREBASE_PROJECT_ID not set');
    }
    return firebase_admin_1.default;
}
async function verifyFirebaseToken(idToken) {
    if (!initialized) {
        throw new Error('Firebase Admin not initialized');
    }
    return firebase_admin_1.default.auth().verifyIdToken(idToken, true);
}
//# sourceMappingURL=firebaseAdmin.js.map