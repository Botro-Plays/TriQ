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
        console.log('[FCM] Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('[FCM] Permission:', permission);
        if (permission !== 'granted') {
          console.warn('[FCM] Notification permission denied — push will not work');
          return;
        }

        // Register FCM service worker at root scope so it receives push events for all app pages
        console.log('[FCM] Registering service worker...');
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await registration.update();
        console.log('[FCM] Service worker registered, scope:', registration.scope);

        const messaging = getMessaging(app);
        console.log('[FCM] Getting FCM token with VAPID key...');
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
        if (!token || cancelled) {
          console.warn('[FCM] No token returned — check VAPID key and Firebase config');
          return;
        }
        console.log('[FCM] Token obtained, saving to server for role:', role);

        // Save token to server based on user role
        if (role === 'DRIVER') {
          const driverRes = await api.get('/drivers', { params: { userId: user.id } });
          const driverId = driverRes.data?.id;
          if (driverId) {
            await api.patch(`/drivers/${driverId}/fcm-token`, { fcmToken: token });
            console.log('[FCM] Driver token saved, driverId:', driverId);
          } else {
            console.warn('[FCM] Could not find driverId for userId:', user.id);
          }
        } else if (role === 'PASSENGER') {
          const passRes = await api.get('/passengers', { params: { userId: user.id } });
          const passengerId = passRes.data?.id;
          if (passengerId) {
            await api.patch(`/passengers/${passengerId}/fcm-token`, { fcmToken: token });
            console.log('[FCM] Passenger token saved, passengerId:', passengerId);
          } else {
            console.warn('[FCM] Could not find passengerId for userId:', user.id);
          }
        }

        // Handle foreground messages (app is in focus — show in-app toast or browser notification)
        onMessage(messaging, (payload) => {
          console.log('[FCM] Foreground message received:', payload.notification?.title);
          const title = payload.notification?.title || 'TriQ';
          const body = payload.notification?.body || '';
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
            });
          }
        });

        console.log('[FCM] Setup complete ✓');
      } catch (err) {
        console.error('[FCM] Registration failed:', err);
      }
    };

    register();
    return () => { cancelled = true; };
  }, [user?.id, role]);
}
