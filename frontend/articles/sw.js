// Service Worker for caching images to improve loading performance
const CACHE_NAME = 'qts-images-v1';
const IMAGE_CACHE_NAME = 'qts-article-images-v1';

// Install event - cache essential resources
self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/css/styles.css',
        '/js/themeManager.js',
        'js/imageProvider.js',
        'js/article-images.js'
      ]);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - cache images and serve from cache when possible
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Only handle external image requests from specific domains
  const isExternalImage = (
    url.hostname.includes('lexica.art') ||
    url.hostname.includes('picsum.photos') ||
    url.hostname.includes('images.unsplash.com')
  ) && /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/.test(url.pathname);

  if (isExternalImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(response => {
          if (response) {
            // Return cached version
            return response;
          }

          // Fetch from network and cache
          return fetch(event.request).then(networkResponse => {
            if (networkResponse.status === 200) {
              // Clone the response before caching
              const responseClone = networkResponse.clone();
              cache.put(event.request, responseClone);
            }
            return networkResponse;
          }).catch(error => {
            console.log('Fetch failed for image:', event.request.url, error);
            // Return a placeholder or fallback if available
            return new Response('', { status: 404 });
          });
        });
      })
    );
  }
  // For all other requests (including local files, JSON, etc.), use default browser behavior
});

// Message event - handle cache management from main thread
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_IMAGE') {
    const { url, query } = event.data;
    caches.open(IMAGE_CACHE_NAME).then(cache => {
      return fetch(url).then(response => {
        if (response.status === 200) {
          const request = new Request(url);
          return cache.put(request, response);
        }
      }).catch(error => {
        console.log('Failed to cache image:', url, error);
      });
    });
  }

  if (event.data && event.data.type === 'CLEAR_IMAGE_CACHE') {
    caches.delete(IMAGE_CACHE_NAME).then(() => {
      console.log('Image cache cleared');
    });
  }
});