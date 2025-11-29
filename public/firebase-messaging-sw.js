// Firebase Messaging Service Worker
// Este archivo debe estar en la raíz del sitio (public/)

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Configuración de Firebase (debe coincidir con la de la app)
firebase.initializeApp({
  apiKey: "AIzaSyBp7MyOW6BL9TDnvZolQyMbWUtKH_nmFAQ",
  authDomain: "planificador-grupal.firebaseapp.com",
  projectId: "planificador-grupal",
  storageBucket: "planificador-grupal.firebasestorage.app",
  messagingSenderId: "1014010017764",
  appId: "1:1014010017764:web:221462ca5685cb63df39f1"
});

const messaging = firebase.messaging();

// Manejar mensajes en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje en segundo plano:', payload);

  const notificationTitle = payload.notification?.title || 'Agenda Grupal';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes un nuevo mensaje',
    icon: '/vite.svg',
    badge: '/vite.svg',
    tag: payload.data?.groupId || 'general',
    data: payload.data,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar clic en la notificación
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Clic en notificación:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Abrir la app o enfocar si ya está abierta
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes('planificador-grupal.web.app') && 'focus' in client) {
          return client.focus();
        }
      }
      // Si no hay ventana abierta, abrir una nueva
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
