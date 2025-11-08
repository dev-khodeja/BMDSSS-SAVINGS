// sw.js - Clean Version
const CACHE_NAME = 'bmdss-savings-v2.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  './image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css'
];

// Install event - cache files
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching files...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All files cached successfully');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker ready!');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache first
self.addEventListener('fetch', event => {
  // Skip non-GET requests and Firebase requests
  if (event.request.method !== 'GET' || 
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        if (response) {
          return response;
        }
        
        return fetch(event.request).then(fetchResponse => {
          // Don't cache if not a valid response
          if (!fetchResponse || fetchResponse.status !== 200) {
            return fetchResponse;
          }
          
          // Cache the new response
          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return fetchResponse;
        });
      })
      .catch(() => {
        // If both cache and network fail, show offline page
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      })
  );
});

// Push notifications for FCM
self.addEventListener('push', event => {
  console.log('Push notification received');
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      notification: {
        title: 'BMDSS Savings',
        body: 'You have a new update!'
      }
    };
  }

  const options = {
    body: data.notification?.body || 'New notification from BMDSS',
    icon: './image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
    badge: './image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
    tag: 'bmdss-notification',
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.notification?.title || 'BMDSS Savings', 
      options
    )
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked');
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then(clientList => {
        // Focus existing app window if available
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window if no existing one
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});

// Background sync (optional - for offline functionality)
self.addEventListener('sync', event => {
  console.log('Background sync:', event.tag);
  if (event.tag === 'background-sync') {
    // Handle background sync here
  }
});

// Real time-notification---


// sw.js - Existing code-এর সাথে add করো
// sw.js - COMPLETELY UPDATED
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);
  
  try {
    let notificationData = {};
    
    if (event.data) {
      notificationData = event.data.json();
    } else {
      // Fallback data if no payload
      notificationData = {
        title: 'BMDSSS 🔔',
        body: 'You have a new notification',
        icon: '/icons/icon-192x192.png'
      };
    }

    const options = {
      body: notificationData.body || notificationData.message,
      icon: notificationData.icon || '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'bmdsss-notification',
      requireInteraction: true,
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'close',
          title: 'Close'
        }
      ],
      data: {
        url: notificationData.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(
        notificationData.title || 'BMDSSS Savings', 
        options
      )
    );
  } catch (error) {
    console.error('Push notification error:', error);
    
    // Fallback simple notification
    const options = {
      body: 'New update from BMDSSS',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'bmdsss-notification'
    };
    
    event.waitUntil(
      self.registration.showNotification('BMDSSS 🔔', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({type: 'window'}).then(windowClients => {
      // Check if app is already open
      for (let client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window if app not open
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/');
      }
    })
  );
});