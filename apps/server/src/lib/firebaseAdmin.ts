import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let initialized = false;

export function initFirebaseAdmin() {
  if (initialized) return admin;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath),
      projectId,
    });
    initialized = true;
    console.log('🔥 Firebase Admin initialized from service account');
  } else if (projectId) {
    // Try application default credentials (works on GCP, may fail elsewhere)
    try {
      admin.initializeApp({ projectId });
      initialized = true;
      console.log('🔥 Firebase Admin initialized with projectId');
    } catch {
      console.warn('⚠️  Firebase Admin not initialized: no service account and no ADC');
    }
  } else {
    console.warn('⚠️  Firebase Admin not initialized: FIREBASE_PROJECT_ID not set');
  }

  return admin;
}

export async function verifyFirebaseToken(idToken: string) {
  if (!initialized) {
    throw new Error('Firebase Admin not initialized');
  }
  return admin.auth().verifyIdToken(idToken, true);
}

export { admin };
