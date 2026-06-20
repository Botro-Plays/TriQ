import admin from 'firebase-admin';
export declare function initFirebaseAdmin(): typeof admin;
export declare function verifyFirebaseToken(idToken: string): Promise<import("firebase-admin/lib/auth/token-verifier").DecodedIdToken>;
export { admin };
//# sourceMappingURL=firebaseAdmin.d.ts.map