importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDpObqM0f_0fSzfyVLNbqpuxFkUM3faj_8',
  authDomain: 'triq-35908.firebaseapp.com',
  projectId: 'triq-35908',
  storageBucket: 'triq-35908.firebasestorage.app',
  messagingSenderId: '1021693609301',
  appId: '1:1021693609301:web:839e1693fe685370661bdc',
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in focus)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'TriQ';
  const body = payload.notification?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: payload.data,
    tag: payload.data?.type || 'triq-notification',
  });
});

// Notification click: open / focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});
