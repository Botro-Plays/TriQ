import { useEffect } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

/**
 * Registers the FCM push token for the current user (driver or passenger).
 * Call once in a top-level component (e.g. Layout or App).
 */
export function useFCM() {
  const { user, role } = useAuthStore();

  useEffect(() => {
    if (!user || !VAPID_KEY) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Register FCM service worker at root scope so it receives push events for all app pages
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        const messaging = getMessaging(app);
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
        if (!token || cancelled) return;

        // Save token to server based on user role
        if (role === 'DRIVER') {
          const driverRes = await api.get('/drivers', { params: { userId: user.id } });
          const driverId = driverRes.data?.id;
          if (driverId) await api.patch(`/drivers/${driverId}/fcm-token`, { fcmToken: token });
        } else if (role === 'PASSENGER') {
          const passRes = await api.get('/passengers', { params: { userId: user.id } });
          const passengerId = passRes.data?.id;
          if (passengerId) await api.patch(`/passengers/${passengerId}/fcm-token`, { fcmToken: token });
        }

        // Handle foreground messages (app is in focus — show in-app toast or browser notification)
        onMessage(messaging, (payload) => {
          const title = payload.notification?.title || 'TriQ';
          const body = payload.notification?.body || '';
          // Show native notification even when in foreground
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
            });
          }
        });
      } catch (err) {
        console.warn('[FCM] Registration failed:', err);
      }
    };

    register();
    return () => { cancelled = true; };
  }, [user?.id, role]);
}
