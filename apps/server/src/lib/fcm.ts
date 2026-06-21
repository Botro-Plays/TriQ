import { admin } from './firebaseAdmin';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a single FCM token.
 * Fails silently (logs error) — never throw, so callers aren't blocked.
 */
export async function sendPush(fcmToken: string | null | undefined, payload: NotificationPayload): Promise<void> {
  if (!fcmToken) return;
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: '/',
        },
      },
    });
  } catch (err: any) {
    // Token invalid / unregistered — log but don't crash
    console.warn('[FCM] sendPush failed:', err?.errorInfo?.code ?? err?.message);
  }
}
