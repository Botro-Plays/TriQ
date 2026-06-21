import admin from 'firebase-admin';
import fs from 'fs';

let initialized = false;

export function initFirebaseAdmin() {
  if (initialized) return admin;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (serviceAccountJson) {
    // Preferred for deployments: paste the service account JSON as an env var
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId || serviceAccount.project_id,
      });
      initialized = true;
      console.log('🔥 Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
    } catch (e: any) {
      console.error('❌ Firebase Admin: failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e?.message);
    }
  } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath),
        projectId,
      });
      initialized = true;
      console.log('🔥 Firebase Admin initialized from service account file');
    } catch (e: any) {
      console.error('❌ Firebase Admin: failed to init from file:', e?.message);
    }
  } else if (projectId) {
    // Try application default credentials (works on GCP/Cloud Run)
    try {
      admin.initializeApp({ projectId });
      initialized = true;
      console.log('🔥 Firebase Admin initialized with projectId (ADC)');
    } catch (e: any) {
      console.warn('⚠️  Firebase Admin not initialized: no service account and ADC failed:', e?.message);
    }
  } else {
    console.warn('⚠️  Firebase Admin not initialized: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID');
  }

  return admin;
}

export function isFirebaseAdminInitialized() {
  return initialized;
}

export async function verifyFirebaseToken(idToken: string) {
  if (!initialized) {
    throw new Error('Firebase Admin not initialized');
  }
  return admin.auth().verifyIdToken(idToken, true);
}

export { admin };
