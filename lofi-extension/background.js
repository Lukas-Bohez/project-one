// Minimal background service worker for the cached lofi extension
self.addEventListener('install', (e) => {
  // nothing special for now
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === 'ping') {
    sendResponse({ ok: true });
  }
});
