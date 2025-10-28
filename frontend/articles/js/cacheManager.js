// Cache management utilities for image caching
window.cacheManager = {
  // Clear all image caches
  clearImageCache: function() {
    return new Promise((resolve, reject) => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_IMAGE_CACHE'
        });
        resolve('Image cache clear request sent to service worker');
      } else {
        // Fallback: clear localStorage cache
        try {
          localStorage.removeItem('qts-articles-ai-images-v2');
          resolve('Local storage cache cleared');
        } catch (error) {
          reject('Failed to clear cache: ' + error);
        }
      }
    });
  },

  // Get cache statistics
  getCacheStats: function() {
    return new Promise((resolve) => {
      if ('caches' in window) {
        caches.keys().then(cacheNames => {
          const stats = { caches: cacheNames.length, names: cacheNames };
          resolve(stats);
        });
      } else {
        resolve({ caches: 0, names: [] });
      }
    });
  },

  // Preload critical images
  preloadImages: function(imageUrls) {
    const promises = imageUrls.map(url => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => reject(url);
        img.src = url;
      });
    });
    return Promise.allSettled(promises);
  }
};

// Add to global scope for debugging
if (typeof window !== 'undefined') {
  window.cacheManager = window.cacheManager;
}