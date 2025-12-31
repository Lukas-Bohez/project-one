// Background state manager service worker with offscreen audio
let songList = [];
let shuffledPlaylist = [];
let currentSongIndex = -1;
let currentPlaylistIndex = -1;
let currentSongId = null;
let isTransitioning = false;
let config = {
    volume: 0.1,
    shuffle: true,
    repeat: false
};
let offscreenDocument = null;

// UI state persistence
let uiState = {
    currentMode: 'bundled',
    isPlaying: false,
    currentSongIndex: -1,
    progress: 0,
    volume: 0.1,
    shuffle: true,
    repeat: false
};

// Initialize offscreen document for audio playback
async function createOffscreenDocument() {
    try {
        const hasDoc = await chrome.offscreen.hasDocument();
        if (hasDoc) {
            return;
        }

        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Play audio tracks in the background'
        });
    } catch (error) {
        console.error('Failed to create offscreen document:', error);
    }
}

// Send message to offscreen document
async function sendToOffscreen(message) {
    try {
        const response = await chrome.runtime.sendMessage(message);
        return response;
    } catch (error) {
        console.error('Failed to send message to offscreen:', error);
        return null;
    }
}

// Helper to forward play requests with a requestId so offscreen can ignore stale plays
function forwardPlayToOffscreen(song) {
    if (typeof lastPlayRequestId === 'undefined') lastPlayRequestId = 0;
    lastPlayRequestId += 1;
    const forwarded = Object.assign({}, song, { requestId: lastPlayRequestId });
    return sendToOffscreen({ action: 'playSong', song: forwarded });
}

// Helper to pause the offscreen player and await acknowledgement (with timeout fallback)
async function awaitPause(timeoutMs = 1000) {
    try {
        const pausePromise = sendToOffscreen({ action: 'pause' });
        const result = await Promise.race([
            pausePromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('pause timeout')), timeoutMs))
        ]);
        return result;
    } catch (err) {
        console.warn('Pause ack failed or timed out:', err && err.message ? err.message : err);
        return null;
    }
}

// Initialize
async function initBackground() {
    try {
        await createOffscreenDocument();
        // If we had a persistent directory handle saved, forward it to the offscreen so it stays loaded (do not scan/persist files by default)
        try {
            const handle = await getDirectoryHandle();
            if (handle) {
                try { await sendToOffscreen({ action: 'setDirectoryHandle', handle: handle }); } catch (e) { console.warn('Failed to send handle to offscreen during init', e); }
            }
        } catch (e) {
            console.warn('No persistent directory handle found on init', e);
        }

        // Periodic keep-alive and ensure the offscreen still has the handle; re-send if it reports missing
        try {
            if (typeof keepAliveInterval === 'undefined') {
                keepAliveInterval = setInterval(async () => {
                    try {
                        const res = await sendToOffscreen({ action: 'ensureHandle' });
                        if (!res || !res.ok) {
                            // Offscreen reports missing handle — re-send saved handle
                            try {
                                const h = await getDirectoryHandle();
                                if (h) await sendToOffscreen({ action: 'setDirectoryHandle', handle: h });
                            } catch (e) { /* ignore */ }
                        }
                    } catch (e) {
                        /* ignore */
                    }
                }, 30000); // 30s keepalive
            }
        } catch (e) {
            console.warn('Failed to setup keepAlive ping', e);
        }
    } catch (e) {
        console.error('Failed to initialize offscreen document:', e);
    }
}

// Create shuffled playlist
function createShuffledPlaylist() {
    shuffledPlaylist = [...songList];
    for (let i = shuffledPlaylist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlaylist[i], shuffledPlaylist[j]] = [shuffledPlaylist[j], shuffledPlaylist[i]];
    }
    currentPlaylistIndex = 0;
}

// Get next song
function getNextSong() {
    if (songList.length === 0) return null;
    if (config.repeat === 'one' && currentSongId) {
        return songList.find(s => s.id === currentSongId);
    }
    if (config.shuffle) {
        if (shuffledPlaylist.length === 0) createShuffledPlaylist();
        const song = shuffledPlaylist[currentPlaylistIndex];
        currentPlaylistIndex = (currentPlaylistIndex + 1) % shuffledPlaylist.length;
        return song;
    } else {
        currentSongIndex = (currentSongIndex + 1) % songList.length;
        return songList[currentSongIndex];
    }
}

// Get previous song
function getPreviousSong() {
    if (songList.length === 0) return null;
    if (config.shuffle) {
        currentPlaylistIndex = (currentPlaylistIndex - 1 + shuffledPlaylist.length) % shuffledPlaylist.length;
        return shuffledPlaylist[currentPlaylistIndex];
    } else {
        currentSongIndex = (currentSongIndex - 1 + songList.length) % songList.length;
        return songList[currentSongIndex];
    }
}

// Get next song for auto-advance
function getNextSongForAutoAdvance() {
    if (songList.length === 0) return null;
    if (config.repeat === 'one' && currentSongId) {
        return songList.find(s => s.id === currentSongId);
    }
    return getNextSong();
}

// Unified message listener (handles requests from popup and messages from the offscreen document)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // If message originates from the offscreen document, handle those actions first
    if (sender && sender.url && sender.url.includes('offscreen.html')) {
        switch (msg.action) {
            case 'songEnded':
                // Auto-advance to next song
                const nextSongOff = getNextSongForAutoAdvance();
                if (nextSongOff) {
                    currentSongId = nextSongOff.id;
                    const index = songList.findIndex(s => s.id === currentSongId);
                    if (index !== -1) {
                        uiState.currentSongIndex = index;
                    }
                    // Inform popup for UI sync
                    try { chrome.runtime.sendMessage({ action: 'nowPlaying', song: nextSongOff, index }); } catch (e) {}
                    // Use request-id forwarding to avoid stale overlaps
                    forwardPlayToOffscreen(nextSongOff);
                }
                break;
            case 'timeUpdate':
                // Forward time updates to popup
                chrome.runtime.sendMessage({
                    action: 'timeUpdate',
                    currentTime: msg.currentTime,
                    duration: msg.duration
                });
                break;
            case 'metadataLoaded':
                chrome.runtime.sendMessage({ action: 'metadataLoaded', duration: msg.duration });
                break;
            case 'playFailed':
                chrome.runtime.sendMessage({ action: 'playFailed', error: msg.error });
                break;
            case 'audioError':
                chrome.runtime.sendMessage({ action: 'audioError', error: msg.error });
                break;
        }

        // Offscreen-originated messages are handled here; no further response expected
        return;
    }

    // Messages from popup or other extension contexts
    switch (msg.action) {
        case 'init':
            initBackground();
            sendResponse({ ok: true });
            break;
        case 'loadSongs':
            songList = msg.songs;
            songList.forEach(song => {
                if (!song.id) song.id = song.url;
            });
            if (config.shuffle) createShuffledPlaylist();
            sendResponse({ ok: true });
            break;
        case 'playSong':
            currentSongId = msg.song.id;
            const playIndex = songList.findIndex(s => s.id === currentSongId);
            if (playIndex !== -1) {
                uiState.currentSongIndex = playIndex;
            }
            // Inform popup so UI updates (e.g., thumbnail, now playing)
            try {
                chrome.runtime.sendMessage({ action: 'nowPlaying', song: msg.song, index: playIndex });
            } catch (e) { /* best-effort */ }
            // Strict handshake: pause the offscreen player first, then forward the play request
            (async () => {
                await awaitPause(1000);
                try {
                    const res = await forwardPlayToOffscreen(msg.song);
                    try { sendResponse({ ok: true }); } catch (e) {}
                } catch (err) {
                    try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {}
                }
            })();
            return true;
        case 'pause':
            // Forward pause to the offscreen document to stop playback
            sendToOffscreen({ action: 'pause' }).then(() => {
                try { sendResponse({ ok: true }); } catch (e) {}
            }).catch(err => { try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {} });
            return true;
        case 'resume':
            // Forward resume to the offscreen document
            sendToOffscreen({ action: 'resume' }).then(() => { try { sendResponse({ ok: true }); } catch (e) {} }).catch(err => { try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {} });
            return true;
        case 'setVolume':
            config.volume = msg.volume;
            // Forward volume change to offscreen
            sendToOffscreen({ action: 'setVolume', volume: msg.volume }).then(() => { try { sendResponse({ ok: true }); } catch (e) {} }).catch(err => { try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {} });
            return true;
        case 'seek':
            // Forward seek to offscreen document
            sendToOffscreen({ action: 'seek', time: msg.time }).then(() => { try { sendResponse({ ok: true }); } catch (e) {} }).catch(err => { try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {} });
            return true;
        case 'getNextSong':
            const nextSong = msg.auto ? getNextSongForAutoAdvance() : getNextSong();
            sendResponse({ song: nextSong });
            break;
        case 'getPrevSong':
            const prevSong = getPreviousSong();
            sendResponse({ song: prevSong });
            break;
        case 'setShuffle':
            config.shuffle = msg.shuffle;
            if (config.shuffle) createShuffledPlaylist();
            sendResponse({ ok: true });
            break;
        case 'setRepeat':
            config.repeat = msg.repeat;
            sendResponse({ ok: true });
            break;
        case 'getConfig':
            sendResponse({ shuffle: config.shuffle, repeat: config.repeat, volume: config.volume });
            break;
        case 'getStatus':
            // Forward to offscreen document and proxy response
            sendToOffscreen({ action: 'getStatus' }).then(status => sendResponse(status)).catch(() => sendResponse({}));
            return true; // Keep channel open for async response


        case 'createOffscreen':
            createOffscreenDocument().then(() => sendResponse({ success: true })).catch(error => sendResponse({ success: false, error: error.message }));
            return true;

        case 'saveDirectoryHandle':
            saveDirectoryHandle(msg.handle).then(() => sendResponse({ success: true })).catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        case 'getDirectoryHandle':
            getDirectoryHandle().then(handle => sendResponse({ handle: handle })).catch(error => sendResponse({ handle: null, error: error.message }));
            return true;
        case 'saveSongMetadata':
            saveSongMetadata(msg.metadata).then(() => sendResponse({ success: true })).catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        case 'getSongMetadata':
            getSongMetadata().then(metadata => sendResponse({ metadata: metadata })).catch(error => sendResponse({ metadata: [], error: error.message }));
            return true;
        case 'requestPlaySong':
            // Received a play request from popup; attach persistent directory handle when available and forward to offscreen
            (async () => {
                try {
                    currentSongId = msg.song.id || msg.song.id;
                    const playIndexReq = songList.findIndex(s => s.id === currentSongId || s.file === (msg.song && msg.song.file));
                    if (playIndexReq !== -1) {
                        uiState.currentSongIndex = playIndexReq;
                    }
                    // Construct forwarding song object
                    let forwardSong = msg.song || {};
                    if (!forwardSong.url && persistentDirectoryHandle && forwardSong.file) {
                        // Pass directory handle and filename to offscreen; offscreen will resolve file handle
                        forwardSong = { dirHandle: persistentDirectoryHandle, filename: forwardSong.file, title: msg.song.title, artist: msg.song.artist, id: msg.song.id };
                    }
                    // Notify popup
                    try { chrome.runtime.sendMessage({ action: 'nowPlaying', song: msg.song }); } catch (e) {}

                    // Strict handshake: pause the offscreen player first, then forward the play request
                    await awaitPause(1000);
                    const res = await forwardPlayToOffscreen(forwardSong);
                    try { sendResponse({ ok: true }); } catch (e) {}
                } catch (err) {
                    try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {}
                }
            })();
            return true;
        case 'getUIState':
            sendResponse({ uiState: uiState });
            break;
        case 'setUIState':
            uiState = { ...uiState, ...msg.uiState };
            sendResponse({ success: true });
            break;
        case 'clearDirectoryHandle':
            persistentDirectoryHandle = null;
            persistentSongMetadata = [];
            // Clear from IndexedDB too
            openDB().then(db => {
                const transaction = db.transaction(['handles', 'metadata'], 'readwrite');
                transaction.objectStore('handles').clear();
                transaction.objectStore('metadata').clear();
                transaction.oncomplete = () => sendResponse({ success: true });
                transaction.onerror = () => sendResponse({ success: false });
            }).catch(() => sendResponse({ success: false }));
            return true;
        default:
            sendResponse({ ok: false });
    }
    return true; // Keep channel open for async responses
});

// Directory handle and metadata persistence using IndexedDB
// Global storage for persistent data (no IndexedDB)
let persistentDirectoryHandle = null;
let persistentSongMetadata = [];

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('LofiExtensionDB', 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('handles')) {
                db.createObjectStore('handles');
            }
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata');
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveDirectoryHandle(handle) {
    persistentDirectoryHandle = handle;
    const db = await openDB();
    const transaction = db.transaction(['handles'], 'readwrite');
    const store = transaction.objectStore('handles');
    store.put(handle, 'directoryHandle');
    // Also inform the offscreen player to keep the directory handle open
    try {
        sendToOffscreen({ action: 'setDirectoryHandle', handle: handle });
    } catch (e) {
        console.warn('Failed to forward directory handle to offscreen:', e);
    }
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function getDirectoryHandle() {
    if (persistentDirectoryHandle) {
        return persistentDirectoryHandle;
    }
    const db = await openDB();
    const transaction = db.transaction(['handles'], 'readonly');
    const store = transaction.objectStore('handles');
    const request = store.get('directoryHandle');
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            persistentDirectoryHandle = request.result;
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

async function saveSongMetadata(metadata) {
    persistentSongMetadata = metadata;
    const db = await openDB();
    const transaction = db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    store.put(metadata, 'songMetadata');
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
}

async function getSongMetadata() {
    if (persistentSongMetadata && persistentSongMetadata.length > 0) {
        return persistentSongMetadata;
    }
    const db = await openDB();
    const transaction = db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');
    const request = store.get('songMetadata');
    return new Promise((resolve, reject) => {
        request.onsuccess = () => {
            persistentSongMetadata = request.result || [];
            resolve(request.result || []);
        };
        request.onerror = () => reject(request.error);
    });
}
chrome.commands.onCommand.addListener((command) => {
    console.log('Command received:', command);

    switch (command) {
        case 'play-pause':
            // Get current status and toggle
            sendToOffscreen({ action: 'getStatus' }).then(status => {
                if (status && status.playing) {
                    sendToOffscreen({ action: 'pause' });
                } else {
                    sendToOffscreen({ action: 'resume' });
                }
            });
            break;

        case 'next-track': {
            (async () => {
                const nextSong = getNextSong();
                if (nextSong) {
                    currentSongId = nextSong.id;
                    await awaitPause(1000);
                    forwardPlayToOffscreen(nextSong);
                }
            })();
            break;
        }

        case 'prev-track': {
            (async () => {
                const prevSong = getPreviousSong();
                if (prevSong) {
                    currentSongId = prevSong.id;
                    await awaitPause(1000);
                    forwardPlayToOffscreen(prevSong);
                }
            })();
            break;
        }

        case 'stop-music':
            sendToOffscreen({ action: 'pause' });
            // Reset to beginning of current song
            sendToOffscreen({ action: 'seek', time: 0 });
            break;
    }
});

// Initialize on install
self.addEventListener('install', (e) => {
    initBackground();
});

// Keep service worker alive
self.addEventListener('activate', (event) => {
  initBackground();
  event.waitUntil(clients.claim());
});

// Persistent window management
let mainWindowId = null;

async function openMainWindow() {
  try {
    if (mainWindowId) {
      // Try focus and restore
      try { await chrome.windows.update(mainWindowId, { focused: true, state: 'normal', width: 420, height: 640 }); return; } catch (e) { mainWindowId = null; }
    }
    const wnd = await chrome.windows.create({ url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 420, height: 640 });
    mainWindowId = wnd.id;
  } catch (err) {
    console.warn('Failed to open main window', err);
  }
}



async function closeMainWindow() {
  try {
    if (!mainWindowId) return;
    await chrome.windows.remove(mainWindowId);
    mainWindowId = null;
  } catch (err) {
    console.warn('Failed to close main window', err);
    mainWindowId = null;
  }
}

// Toggle / focus when user clicks the toolbar action (since we removed default_popup)
chrome.action.onClicked.addListener(async () => {
  // Always open (or focus) the main extension window; no minimizing behavior
  if (mainWindowId) {
    try {
      await chrome.windows.update(mainWindowId, { focused: true, state: 'normal' });
      return;
    } catch (err) {
      // window may have been closed externally
      mainWindowId = null;
    }
  }

  await openMainWindow();
});



// Clean up when the main window is removed
chrome.windows.onRemoved.addListener((id) => {
  if (id === mainWindowId) {
    mainWindowId = null;
  }
});

// Message listeners for window actions from popup UI
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.action) {
    case 'closeWindow':
      closeMainWindow().then(() => { try { sendResponse({ ok: true }); } catch (e) {} });
      return true;
  }
});
