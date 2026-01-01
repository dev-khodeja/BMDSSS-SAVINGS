// sw.js - Netlify Compatible Version
const CACHE_NAME = 'bmdss-savings-v2.1.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons/font/bootstrap-icons.css'
];

// Install event - cache files
self.addEventListener('install', event => {
  console.log('Service Worker installing for BMDSS Savings...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching essential files...');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('All essential files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Cache installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating for BMDSS Savings...');
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
      console.log('Service Worker ready and activated!');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache first (Netlify compatible)
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip Firebase and external API calls from cache
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('gstatic.com')) {
    return fetch(event.request);
  }
  
  // Handle navigation requests specially
  if (event.request.mode === 'navigate' ||
      (event.request.method === 'GET' && 
       event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the HTML page
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseClone);
            });
          return response;
        })
        .catch(() => {
          // If offline, return cached version
          return caches.match('/index.html');
        })
    );
    return;
  }
  
  // For other requests
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        return fetch(event.request)
          .then(fetchResponse => {
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
          })
          .catch(error => {
            console.log('Fetch failed; returning offline page:', error);
            // If request is for an image, try to return a placeholder
            if (event.request.destination === 'image') {
              return caches.match('/image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg');
            }
          });
      })
  );
});

// Push notifications handler
self.addEventListener('push', event => {
  console.log('[Service Worker] Push received');
  
  let title = 'BMDSS Savings';
  let body = 'You have a new notification';
  
  try {
    if (event.data) {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || data.message || body;
    }
  } catch (error) {
    console.log('Push data parsing error:', error);
  }
  
  const options = {
    body: body,
    icon: '/image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
    badge: '/image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
    vibrate: [200, 100, 200],
    tag: 'bmdss-notification',
    renotify: true,
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
      url: '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('[Service Worker] Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Focus existing window or open new one
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Message handler for notifications from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, message } = event.data;
    self.registration.showNotification(title, {
      body: message,
      icon: '/image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg',
      badge: '/image/121d1fb6-b13b-411c-9e75-f22e651d063f.jpg'
    });
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync (optional)
self.addEventListener('sync', event => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Implement background data sync here
  console.log('Syncing data in background...');
}

// Periodic sync (for newer browsers)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateCache());
  }
});

async function updateCache() {
  // Update cache periodically
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(urlsToCache);
}