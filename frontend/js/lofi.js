// Simple Random Lofi Player - Enhanced with Shuffle and Repeat Modes
// API Configuration  
const API_BASE_URL = `https://${window.location.hostname}`;

// Configuration
const config = {
    folder: '../lofi/', // Path from js/ to lofi/
    volume: 0.01,
    fadeDuration: 500, // Reduced from 1000ms to 500ms for faster transitions
    shuffle: true, // Default shuffle mode (true = random, false = sequential)
    repeat: false, // Repeat mode: false, 'one', or 'all'
    enableLofi: false, // Disable lofi player by default to prevent 404 errors
    youtube: {
        enabled: true,
        apiKey: '', // Optional: YouTube API key for better metadata
        defaultPlaylist: 'PLrAOxtLmTaTeiV0MD-Y0x6fgz5CH-YNGQ', // Default lofi playlist
        embedDomain: 'https://www.youtube-nocookie.com'
    },
    normalization: {
        enabled: true,
        targetLoudness: -23, // LUFS (Loudness Units relative to Full Scale)
        analysisTime: 3000, // How long to analyze each track (ms)
        cache: true // Cache normalization data
    },
    persistence: { // Enhanced persistence configuration
        enabled: true,
        localStorageKey: 'lofiPlayerState',
        normalizationCacheKey: 'lofiNormalizationCache',
        playerEnabledKey: 'lofiPlayerEnabled',
        youtubePlaylistKey: 'lofiYouTubePlaylist',
        volumeKey: 'lofiVolume',
        currentPlaylistKey: 'lofiCurrentPlaylist'
    }
};

// ADD YOUR AUDIO FILENAMES HERE (only if folder scanning doesn't work)
const manualSongList = [
    // Example: 'my-song.mp3', 'another-track.wav', 'chill-beat.mp3'
    // Leave empty to try folder scanning first
];

// Player elements
const audioPlayer = new Audio();
let audioContext = null;
let analyser = null;
let source = null;
let gainNode = null;
let songList = [];
let shuffledPlaylist = []; // For shuffle mode
let isPlaying = false; // Tracks if the player *should* be playing (can be paused)
let lastPlayedSongs = []; // Track recently played songs
let currentSongIndex = -1; // Current position in playlist
let currentPlaylistIndex = -1; // Current position in shuffled playlist (for shuffle mode)
let normalizationCache = new Map(); // Cache for normalization data
let isTransitioning = false; // Prevent overlapping fades/loads

// YouTube player variables
let youtubePlayer = null;
let youtubePlayerReady = false;
let isYouTubeMode = false;
let youtubePlaylist = [];
let lofiActivated = false; // Track if user has activated the lofi player
let youtubeProgressTimer = null; // Polling timer for YT progress updates

// --- Persistence Variables ---
let savedPlaybackState = null; // To hold state loaded from localStorage
let cachedYouTubePlaylist = []; // Cached YouTube songs
let cachedVolume = config.volume; // Cached volume setting
let isPlayerEnabled = false; // Cached player enabled state

// IndexedDB for audio blob caching
let lofiDB = null;

// --- Unicode/URL helpers ---
// Detect if a string already contains percent-encoded bytes
const isPercentEncoded = (s) => /%[0-9A-Fa-f]{2}/.test(s);
// Safely decode URI components; if not encoded, return original
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
// Encode a filename for use in a URL path segment without double-encoding
const toUrlFilename = (name) => isPercentEncoded(name) ? name : encodeURIComponent(name);
// Build a playable song URL from folder + filename, handling Unicode universally
const buildSongPath = (name) => `${config.folder}${toUrlFilename(name)}`;

const openLofiDB = async () => {
    if (lofiDB) return lofiDB;
    
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('lofi-cache', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            lofiDB = request.result;
            resolve(lofiDB);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('audioBlobs')) {
                const store = db.createObjectStore('audioBlobs', { keyPath: 'id' });
                store.createIndex('videoId', 'videoId', { unique: false });
                store.createIndex('status', 'status', { unique: false });
            }
        };
    });
};

// Clean up titles that may contain percent-encoding or odd prefixes
const prettyTitle = (s) => {
    if (!s || typeof s !== 'string') return s;
    let t = s.trim();
    // Remove common stray charset prefixes
    t = t.replace(/^utf[-_]?8/i, '');
    // Replace plus (form-encoding) with spaces, then percent-decode safely
    t = t.replace(/\+/g, ' ');
    t = safeDecode(t);
    // Collapse repeated whitespace
    t = t.replace(/\s{2,}/g, ' ').trim();
    return t;
};

const getCachedAudioBlob = async (videoId) => {
    try {
        const db = await openLofiDB();
        const transaction = db.transaction(['audioBlobs'], 'readonly');
        const store = transaction.objectStore('audioBlobs');
        
        return new Promise((resolve, reject) => {
            const request = store.get(videoId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error getting cached audio blob:', error);
        return null;
    }
};

const saveCachedAudioBlob = async (videoId, blob, metadata = {}) => {
    try {
        const db = await openLofiDB();
        const transaction = db.transaction(['audioBlobs'], 'readwrite');
        const store = transaction.objectStore('audioBlobs');
        
        const record = {
            id: videoId,
            videoId: videoId,
            blob: blob,
            status: 'ready',
            title: metadata.title || videoId,
            fileExt: 'mp3',
            cachedAt: new Date().toISOString(),
            ...metadata
        };
        
        return new Promise((resolve, reject) => {
            const request = store.put(record);
            request.onsuccess = () => resolve(record);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error saving cached audio blob:', error);
        throw error;
    }
};

const hasCachedAudio = async (videoId) => {
    const cached = await getCachedAudioBlob(videoId);
    return cached && cached.status === 'ready' && cached.blob;
};

const listCachedAudioKeys = async () => {
    try {
        const db = await openLofiDB();
        const transaction = db.transaction(['audioBlobs'], 'readonly');
        const store = transaction.objectStore('audioBlobs');
        
        return new Promise((resolve, reject) => {
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error listing cached audio keys:', error);
        return [];
    }
};

const updateCachedAudioStatus = async (videoId, updates) => {
    try {
        const db = await openLofiDB();
        const transaction = db.transaction(['audioBlobs'], 'readwrite');
        const store = transaction.objectStore('audioBlobs');
        
        return new Promise(async (resolve, reject) => {
            // Get existing record
            const getRequest = store.get(videoId);
            getRequest.onsuccess = () => {
                const existing = getRequest.result || { 
                    id: videoId, 
                    videoId: videoId, 
                    status: 'pending',
                    title: videoId,
                    fileExt: 'mp3'
                };
                
                // Update with new data
                const updated = { ...existing, ...updates };
                
                const putRequest = store.put(updated);
                putRequest.onsuccess = () => resolve(updated);
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    } catch (error) {
        console.error('Error updating cached audio status:', error);
        throw error;
    }
};

// Load persisted simple settings early (enable flag, volume, YouTube list)
const loadPersistentSettings = () => {
    try {
        if (!config.persistence?.enabled) return;
        const enabledRaw = localStorage.getItem(config.persistence.playerEnabledKey);
        isPlayerEnabled = enabledRaw ? JSON.parse(enabledRaw) : false;

        const volRaw = localStorage.getItem(config.persistence.volumeKey);
        if (volRaw !== null) {
            const v = parseFloat(volRaw);
            if (Number.isFinite(v)) {
                cachedVolume = Math.max(0, Math.min(1, v));
                config.volume = cachedVolume; // sync config default for UI
            }
        }

        const ytRaw = localStorage.getItem(config.persistence.youtubePlaylistKey);
        if (ytRaw) {
            const list = JSON.parse(ytRaw);
            if (Array.isArray(list)) {
                cachedYouTubePlaylist = list;
                console.log('Loaded YouTube playlist from cache:', cachedYouTubePlaylist.length, 'items');
                // Migrate old schema items
                migrateYouTubeCacheSchema();
            }
        } else {
            console.log('No cached YouTube playlist found');
        }
    } catch (err) {
        console.warn('Failed to load persistent settings:', err);
        isPlayerEnabled = false;
        cachedYouTubePlaylist = [];
        cachedVolume = config.volume;
    }
};

// Create activation button
const createActivationButton = () => {
    const activateBtn = document.createElement('button');
    activateBtn.id = 'lofi-activate-btn';
    activateBtn.innerHTML = '🎵 Activate Music Player';
    activateBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        z-index: 9999;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        border-radius: 25px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
    `;
    
    activateBtn.addEventListener('mouseenter', () => {
        activateBtn.style.transform = 'translateY(-2px)';
        activateBtn.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.4)';
    });
    
    activateBtn.addEventListener('mouseleave', () => {
        activateBtn.style.transform = 'translateY(0)';
        activateBtn.style.boxShadow = '0 4px 15px rgba(99, 102, 241, 0.3)';
    });
    
    activateBtn.addEventListener('click', () => {
        activateLofiPlayer();
        activateBtn.remove();
    });
    
    document.body.appendChild(activateBtn);
};

// Activate the lofi player
const activateLofiPlayer = () => {
    lofiActivated = true;
    console.log('Lofi player activated by user');
    try {
        if (config.persistence?.enabled) {
            localStorage.setItem(config.persistence.playerEnabledKey, 'true');
            isPlayerEnabled = true;
        }
    } catch (e) { console.warn('Could not persist activation:', e); }
    
    // Load persisted state if persistence is enabled
    if (config.persistence.enabled) {
        loadPlayerState();
        loadNormalizationCache();
    }

    // Initialize UI elements
    createFloatingIcon();
    createLofiModal();

    // Apply cached volume now that DOM/UI exists
    try {
        audioPlayer.volume = Math.max(0, Math.min(1, cachedVolume));
        const slider = document.getElementById('volume-slider');
        const display = document.getElementById('volume-display');
        if (slider) slider.value = cachedVolume;
        if (display) display.textContent = `${Math.round(cachedVolume * 100)}%`;
    } catch(_) {}

    // Setup user interaction listeners for auto-start
    setupAutoStartListeners();

    // Save state before leaving the page
    window.addEventListener('beforeunload', savePlayerState);
    
    // Periodic state saving for better persistence
    setInterval(() => {
        if (isPlaying && !audioPlayer.paused) {
            savePlayerState();
        }
    }, 10000);
};

// Load YouTube API
const loadYouTubeAPI = () => {
    if (window.YT) {
        console.log('YouTube API already loaded');
        return;
    }
    
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    // YouTube API callback
    window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready');
        youtubePlayerReady = true;
    };
};

// Extract video ID from YouTube URL
const extractYouTubeId = (url) => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/playlist\?list=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
};

// Create YouTube player
const createYouTubePlayer = (containerId, videoId, isPlaylist = false) => {
    if (!youtubePlayerReady) {
        console.warn('YouTube API not ready');
        return null;
    }
    
    const playerVars = {
        autoplay: 1,
        controls: 1,
        rel: 0,
        showinfo: 0,
        modestbranding: 1
    };
    
    if (isPlaylist) {
        playerVars.listType = 'playlist';
        playerVars.list = videoId;
    }
    
    return new YT.Player(containerId, {
        height: '0',
        width: '0',
        videoId: isPlaylist ? undefined : videoId,
        playerVars: playerVars,
        events: {
            onReady: onYouTubePlayerReady,
            onStateChange: onYouTubePlayerStateChange
        }
    });
};

// YouTube player ready callback
const onYouTubePlayerReady = (event) => {
    console.log('YouTube player ready');
    youtubePlayer = event.target;
    // Apply saved or current volume (0-100 scale)
    try {
        let v = config.volume;
        if (config.persistence?.enabled) {
            const raw = localStorage.getItem(config.persistence.volumeKey);
            if (raw != null) {
                const parsed = parseFloat(raw);
                if (Number.isFinite(parsed)) v = Math.max(0, Math.min(1, parsed));
            }
        }
        youtubePlayer.setVolume(Math.round(v * 100));
    } catch(_) {}
};

// YouTube player state change callback
const onYouTubePlayerStateChange = (event) => {
    switch(event.data) {
        case YT.PlayerState.PLAYING:
            isPlaying = true;
            console.log('YouTube video playing');
            startYouTubeProgressPolling();
            break;
        case YT.PlayerState.PAUSED:
            isPlaying = false;
            console.log('YouTube video paused');
            stopYouTubeProgressPolling();
            break;
        case YT.PlayerState.ENDED:
            console.log('YouTube video ended');
            stopYouTubeProgressPolling();
            if (config.repeat === 'all') {
                playNextYouTube();
            }
            break;
    }
};

function startYouTubeProgressPolling() {
    stopYouTubeProgressPolling();
    youtubeProgressTimer = setInterval(() => {
        updateProgressBar();
    }, 250);
}

function stopYouTubeProgressPolling() {
    if (youtubeProgressTimer) {
        clearInterval(youtubeProgressTimer);
        youtubeProgressTimer = null;
    }
}

// Play next YouTube video
const playNextYouTube = () => {
    if (youtubePlayer && youtubePlaylist.length > 1) {
        youtubePlayer.nextVideo();
    }
};

// Switch to YouTube mode
const switchToYouTube = (url) => {
    // Strict mode separation: only play YouTube content in YouTube mode
    if (!isYouTubeMode) {
        console.log('MODE: In Local mode - YouTube playback blocked. Switch to YouTube mode first.');
        return false;
    }
    
    const videoId = extractYouTubeId(url);
    if (!videoId) {
        console.error('Invalid YouTube URL');
        return false;
    }
    
    // Stop local audio if playing (but we'll keep YouTube mode)
    if (!audioPlayer.paused) {
        audioPlayer.pause();
    }
    
    // Create hidden container for YouTube player
    let container = document.getElementById('youtube-player-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'youtube-player-container';
        container.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px;';
        document.body.appendChild(container);
    }
    
    // Determine if it's a playlist
    const isPlaylist = url.includes('playlist?list=');
    
    // Create YouTube player
    if (youtubePlayerReady) {
        youtubePlayer = createYouTubePlayer('youtube-player-container', videoId, isPlaylist);
        isYouTubeMode = true;
        return true;
    } else {
        console.warn('YouTube API not ready yet');
        return false;
    }
};

// --- YouTube persistence helpers ---
const parseYouTubeInput = (input) => {
    const normalizeVideoId = (id) => id && id.trim();
    const normalizePlaylistId = (id) => id && id.trim();
    try {
        const u = new URL(input);
        const host = u.hostname.replace('www.', '');
        const list = u.searchParams.get('list');
        const v = u.searchParams.get('v');
        // Short URLs: youtu.be/<id>
        if (host === 'youtu.be') {
            const id = u.pathname.split('/').filter(Boolean)[0];
            if (id) return { type: 'video', id: normalizeVideoId(id), url: `https://www.youtube.com/watch?v=${id}` };
        }
        // Shorts or embed
        if (host.endsWith('youtube.com')) {
            const path = u.pathname;
            if (path.startsWith('/shorts/')) {
                const id = path.split('/').filter(Boolean)[1];
                if (id) return { type: 'video', id: normalizeVideoId(id), url: `https://www.youtube.com/watch?v=${id}` };
            }
            if (path.startsWith('/embed/')) {
                const id = path.split('/').filter(Boolean)[1];
                if (id) return { type: 'video', id: normalizeVideoId(id), url: `https://www.youtube.com/watch?v=${id}` };
            }
        }
        if (list) return { type: 'playlist', id: normalizePlaylistId(list), url: `https://www.youtube.com/playlist?list=${list}` };
        if (v) return { type: 'video', id: normalizeVideoId(v), url: `https://www.youtube.com/watch?v=${v}` };
    } catch {
        // Allow raw IDs (likely video)
        if (/^[a-zA-Z0-9_-]{10,}$/.test(input)) return { type: 'video', id: input, url: `https://www.youtube.com/watch?v=${input}` };
    }
    return null;
};

const migrateYouTubeCacheSchema = () => {
    // Migrate old schema items to new schema with status tracking
    cachedYouTubePlaylist = cachedYouTubePlaylist.map(item => {
        if (!item.status) {
            // Add new fields to existing items
            return {
                ...item,
                title: item.title || (item.type === 'video' ? `Video ${item.id}` : `Playlist ${item.id}`),
                status: 'stream', // Default to streaming mode
                hasBlob: false,
                fileExt: 'mp3',
                downloadId: null,
                progress: 0,
                addedAt: item.addedAt || new Date().toISOString()
            };
        }
        return item;
    });
    
    // Save migrated data
    try {
        localStorage.setItem(config.persistence.youtubePlaylistKey, JSON.stringify(cachedYouTubePlaylist));
        console.log('YOUTUBE: Cache schema migrated successfully');
    } catch (e) {
        console.error('YOUTUBE: Migration save failed:', e);
    }
};

const addYouTubeToCachedList = (input) => {
    if (!config.persistence?.enabled) {
        console.warn('Persistence not enabled, cannot cache YouTube item');
        return false;
    }
    const parsedItem = parseYouTubeInput(input);
    if (!parsedItem) {
        console.warn('Could not parse YouTube input:', input);
        return false;
    }
    console.log('Parsed YouTube item:', parsedItem);
    
    const exists = cachedYouTubePlaylist.some(x => x.id === parsedItem.id && x.type === parsedItem.type);
    if (!exists) {
        // Create full item with new schema
        const item = {
            ...parsedItem,
            title: parsedItem.title || (parsedItem.type === 'video' ? `Video ${parsedItem.id}` : `Playlist ${parsedItem.id}`),
            status: 'stream', // Start as streaming, will be updated when conversion starts
            hasBlob: false,
            fileExt: 'mp3',
            downloadId: null,
            progress: 0,
            addedAt: new Date().toISOString()
        };
        
        cachedYouTubePlaylist.push(item);
        console.log('Added to cache, new list length:', cachedYouTubePlaylist.length);
        try { 
            localStorage.setItem(config.persistence.youtubePlaylistKey, JSON.stringify(cachedYouTubePlaylist)); 
            console.log('Saved to localStorage successfully');
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
        refreshCachedYouTubeListUI();
        
        // Schedule download in background
        scheduleYouTubeDownload(item);
        return true;
    } else {
        console.log('Item already exists in cache');
        // Still refresh UI in case status has changed
        refreshCachedYouTubeListUI();
    }
    return false;
};

// Schedule YouTube video download and conversion
const scheduleYouTubeDownload = async (item) => {
    if (!item || item.status === 'converting' || item.status === 'ready') {
        return; // Skip if already in progress or ready
    }
    
    try {
        console.log('DOWNLOAD: Scheduling conversion for', item.id);
        
        // Update status to converting
        item.status = 'converting';
        item.progress = 0;
        updateYouTubeItemInCache(item);
        
        // Start conversion via backend
        const convertResponse = await fetch(`${API_BASE_URL}/api/v1/video/convert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: item.url,
                format: 1, // MP3
                quality: 128
            })
        });
        
        const convertResult = await convertResponse.json();
        
        if (!convertResponse.ok) {
            throw new Error(convertResult.error || 'Conversion request failed');
        }
        
        item.downloadId = convertResult.download_id;
        updateYouTubeItemInCache(item);
        console.log('DOWNLOAD: Conversion started with ID:', item.downloadId);
        
        // Start polling for completion
        pollYouTubeConversion(item);
        
    } catch (error) {
        console.error('DOWNLOAD: Failed to start conversion:', error);
        item.status = 'error';
        item.error = error.message;
        updateYouTubeItemInCache(item);
    }
};

// Poll conversion status and download when ready
const pollYouTubeConversion = async (item) => {
    if (!item.downloadId) {
        console.error('DOWNLOAD: No download ID for polling');
        return;
    }
    
    const pollInterval = setInterval(async () => {
        try {
            const statusResponse = await fetch(`${API_BASE_URL}/api/v1/video/status/${item.downloadId}`);
            const status = await statusResponse.json();
            
            if (!statusResponse.ok) {
                throw new Error(status.error || 'Status check failed');
            }
            
            // Update progress with retry info
            item.progress = Math.round(status.progress || 0);
            item.retryAttempt = status.retry_attempt || 0;
            
            if (status.status === 'completed') {
                clearInterval(pollInterval);
                console.log('DOWNLOAD: Conversion completed, downloading blob...');
                
                // Download the converted file
                const downloadResponse = await fetch(`${API_BASE_URL}/api/v1/video/download/${item.downloadId}`);
                
                if (!downloadResponse.ok) {
                    throw new Error('Download failed');
                }
                
                const blob = await downloadResponse.blob();
                
                // Extract title from response headers if available
                const contentDisposition = downloadResponse.headers.get('content-disposition');
                const titleMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                const extractedTitle = titleMatch ? titleMatch[1].replace(/['"]/g, '') : null;
                
                if (extractedTitle) {
                    item.title = extractedTitle.replace(/\.(mp3|mp4)$/i, '');
                }
                
                // Save blob to IndexedDB
                await saveCachedAudioBlob(item.id, blob, {
                    title: item.title,
                    url: item.url,
                    downloadId: item.downloadId
                });
                
                // Update item status
                item.status = 'ready';
                item.hasBlob = true;
                item.progress = 100;
                updateYouTubeItemInCache(item);
                
                console.log('DOWNLOAD: Successfully cached audio for', item.title);
                refreshCachedYouTubeListUI();
                
            } else if (status.status === 'error') {
                clearInterval(pollInterval);
                throw new Error(status.error || 'Conversion failed');
            } else {
                // Still processing, update UI
                updateYouTubeItemInCache(item);
            }
            
        } catch (error) {
            clearInterval(pollInterval);
            console.error('DOWNLOAD: Polling failed:', error);
            item.status = 'error';
            item.error = error.message;
            updateYouTubeItemInCache(item);
            refreshCachedYouTubeListUI();
        }
    }, 2000); // Poll every 2 seconds
};

// Update a YouTube item in the cache and persist
const updateYouTubeItemInCache = (updatedItem) => {
    const index = cachedYouTubePlaylist.findIndex(item => item.id === updatedItem.id);
    if (index !== -1) {
        cachedYouTubePlaylist[index] = { ...cachedYouTubePlaylist[index], ...updatedItem };
        try {
            localStorage.setItem(config.persistence.youtubePlaylistKey, JSON.stringify(cachedYouTubePlaylist));
        } catch (e) {
            console.error('Failed to update cache in localStorage:', e);
        }
    }
};

// Resume pending downloads on app start
const resumePendingDownloads = async () => {
    const pendingItems = cachedYouTubePlaylist.filter(item => 
        item.status === 'converting' || item.status === 'stream'
    );
    
    console.log('DOWNLOAD: Resuming', pendingItems.length, 'pending downloads');
    
    for (const item of pendingItems) {
        if (item.status === 'converting' && item.downloadId) {
            // Resume polling existing conversion
            pollYouTubeConversion(item);
        } else if (item.status === 'stream') {
            // Schedule new conversion
            setTimeout(() => scheduleYouTubeDownload(item), Math.random() * 2000); // Stagger requests
        }
    }
};

const removeYouTubeCachedItem = (idx) => {
    if (!Array.isArray(cachedYouTubePlaylist)) return false;
    if (idx < 0 || idx >= cachedYouTubePlaylist.length) return false;
    cachedYouTubePlaylist.splice(idx, 1);
    try { localStorage.setItem(config.persistence.youtubePlaylistKey, JSON.stringify(cachedYouTubePlaylist)); } catch {}
    refreshCachedYouTubeListUI();
    return true;
};

const refreshCachedYouTubeListUI = () => {
    const container = document.getElementById('youtube-playlist');
    if (!container) {
        console.log('YouTube playlist container not found, skipping UI refresh');
        return;
    }
    container.innerHTML = '';
    console.log('Refreshing YouTube list UI with', cachedYouTubePlaylist.length, 'items');
    if (!Array.isArray(cachedYouTubePlaylist) || cachedYouTubePlaylist.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No saved items yet.';
        empty.style.color = 'var(--light-color, #f4f8fc)';
        empty.style.opacity = '0.8';
        container.appendChild(empty);
        return;
    }
    cachedYouTubePlaylist.forEach((item, idx) => {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '10px';
        row.style.fontSize = '1rem';
        row.style.flexWrap = 'wrap';
        row.style.padding = '8px 0';
        row.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
        
        // Title/URL container
        const titleContainer = document.createElement('div');
        titleContainer.style.flex = '1 1 auto';
        titleContainer.style.minWidth = '200px';
        
    const title = document.createElement('div');
    title.textContent = prettyTitle(item.title) || `${item.type === 'playlist' ? 'Playlist' : 'Video'} · ${item.id}`;
        title.style.color = 'var(--light-color, #f4f8fc)';
        title.style.fontWeight = '500';
        title.style.wordBreak = 'break-word';
        title.style.marginBottom = '4px';
        
        // Status badge
        const statusBadge = document.createElement('span');
        let badgeColor, badgeText;
        
        switch (item.status) {
            case 'ready':
                badgeColor = 'var(--success-color, #2e8b34)';
                badgeText = '🎵 Cached';
                break;
            case 'converting':
                badgeColor = 'var(--warning-color, #e65100)';
                badgeText = `🔄 Converting ${item.progress || 0}%`;
                break;
            case 'error':
                badgeColor = 'var(--danger-color, #d32f2f)';
                badgeText = '❌ Error';
                break;
            default:
                badgeColor = 'var(--info-color, #0d61aa)';
                badgeText = '🌐 Stream';
        }
        
        statusBadge.textContent = badgeText;
        statusBadge.style.backgroundColor = badgeColor;
        statusBadge.style.color = 'white';
        statusBadge.style.padding = '2px 6px';
        statusBadge.style.borderRadius = '12px';
        statusBadge.style.fontSize = '0.75rem';
        statusBadge.style.display = 'inline-block';
        
        titleContainer.appendChild(title);
        titleContainer.appendChild(statusBadge);
        
        // Action buttons container
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '6px';
        actions.style.flexShrink = '0';
        
        // Play button (cached or stream)
        const playBtn = document.createElement('button');
        if (item.status === 'ready') {
            playBtn.textContent = 'Play (Cached)';
            playBtn.style.backgroundColor = 'var(--success-color, #2e8b34)';
            playBtn.addEventListener('click', () => playCachedYouTubeItem(item));
        } else {
            playBtn.textContent = 'Play (Stream)';
            playBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
            playBtn.addEventListener('click', () => switchToYouTube(item.url));
        }
        playBtn.style.color = 'var(--light-color, #f4f8fc)';
        playBtn.style.border = 'none';
        playBtn.style.padding = '4px 8px';
        playBtn.style.borderRadius = '4px';
        playBtn.style.cursor = 'pointer';
        playBtn.style.fontSize = '0.85rem';
        
        // Download/Retry button
        const downloadBtn = document.createElement('button');
        if (item.status === 'error') {
            downloadBtn.textContent = 'Retry';
            downloadBtn.style.backgroundColor = 'var(--warning-color, #e65100)';
            downloadBtn.addEventListener('click', () => {
                item.status = 'stream';
                item.error = null;
                updateYouTubeItemInCache(item);
                scheduleYouTubeDownload(item);
                refreshCachedYouTubeListUI();
            });
        } else if (item.status === 'ready') {
            downloadBtn.textContent = 'Re-cache';
            downloadBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
            downloadBtn.addEventListener('click', () => {
                item.status = 'stream';
                updateYouTubeItemInCache(item);
                scheduleYouTubeDownload(item);
                refreshCachedYouTubeListUI();
            });
        } else {
            downloadBtn.textContent = item.status === 'converting' ? 'Converting...' : 'Cache';
            downloadBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
            downloadBtn.disabled = item.status === 'converting';
            downloadBtn.addEventListener('click', () => {
                if (item.status === 'stream') {
                    scheduleYouTubeDownload(item);
                    refreshCachedYouTubeListUI();
                }
            });
        }
        downloadBtn.style.color = 'var(--light-color, #f4f8fc)';
        downloadBtn.style.border = 'none';
        downloadBtn.style.padding = '4px 8px';
        downloadBtn.style.borderRadius = '4px';
        downloadBtn.style.cursor = downloadBtn.disabled ? 'not-allowed' : 'pointer';
        downloadBtn.style.fontSize = '0.85rem';
        downloadBtn.style.opacity = downloadBtn.disabled ? '0.6' : '1';
        
        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.backgroundColor = 'var(--danger-color, #d32f2f)';
        removeBtn.style.color = 'var(--light-color, #f4f8fc)';
        removeBtn.style.border = 'none';
        removeBtn.style.padding = '4px 8px';
        removeBtn.style.borderRadius = '4px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '0.85rem';
        removeBtn.addEventListener('click', () => removeYouTubeCachedItem(idx));
        
        actions.appendChild(playBtn);
        actions.appendChild(downloadBtn);
        actions.appendChild(removeBtn);
        
        row.appendChild(titleContainer);
        row.appendChild(actions);
        container.appendChild(row);
    });
};

// Play cached YouTube item (stays in YouTube mode)
const playCachedYouTubeItem = async (item) => {
    // Strict mode separation: only play YouTube content in YouTube mode
    if (!isYouTubeMode) {
        console.log('MODE: In Local mode - cached YouTube playback blocked. Switch to YouTube mode first.');
        return;
    }
    
    if (item.status !== 'ready') {
        console.warn('Item not ready for cached playback:', item);
        return;
    }
    
    try {
        console.log('CACHED PLAY: Loading cached audio for', item.title);
        
        // Get cached blob from IndexedDB
        const cachedData = await getCachedAudioBlob(item.id);
        if (!cachedData || !cachedData.blob) {
            console.error('CACHED PLAY: No blob found for', item.id);
            return;
        }
        
        // Create object URL from blob
        const objectUrl = URL.createObjectURL(cachedData.blob);
        
        // STAY in YouTube mode - don't switch to local mode
        isYouTubeMode = true;
        updateModeButtons();
        
        // Stop YouTube player if playing
        if (youtubePlayer) {
            try {
                youtubePlayer.pauseVideo();
            } catch (e) {
                console.log('YouTube player not available for pause');
            }
        }
        
        // Stop YouTube progress polling
        stopYouTubeProgressPolling();
        
        // Stop local audio if playing (but we'll use it for cached YouTube)
        if (!audioPlayer.paused) {
            audioPlayer.pause();
        }
        
        // Load cached audio into the main audio player but stay in YouTube mode
        audioPlayer.src = objectUrl;
        audioPlayer.currentTime = 0;
        audioPlayer.volume = config.volume;
        
        // Update now playing for YouTube mode
    updateNowPlaying(`🎵 ${prettyTitle(item.title)} (Cached)`);
        
        // Play the cached audio
        const playPromise = audioPlayer.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('CACHED PLAY: Successfully started playback of', item.title);
                isPlaying = true;
                
                // Update play/pause button
                const playPauseBtn = document.getElementById('play-pause-btn');
                if (playPauseBtn) {
                    playPauseBtn.innerHTML = '⏸️ Pause';
                    playPauseBtn.setAttribute('aria-label', 'Pause');
                }
                
                // Set up ended listener for this cached track
                audioPlayer.addEventListener('ended', () => {
                    URL.revokeObjectURL(objectUrl);
                    isPlaying = false;
                    updateUIForStopped();
                    console.log('Cached YouTube track ended');
                }, { once: true });
                
            }).catch(error => {
                console.error('CACHED PLAY: Failed to start playback:', error);
                URL.revokeObjectURL(objectUrl);
            });
        }
        
        // Clean up object URL on error
        audioPlayer.addEventListener('error', () => {
            URL.revokeObjectURL(objectUrl);
            isPlaying = false;
            updateUIForStopped();
        }, { once: true });
        
    } catch (error) {
        console.error('CACHED PLAY: Failed to play cached item:', error);
    }
};

// Initialize when DOM is ready (respect persisted activation)
document.addEventListener('DOMContentLoaded', () => {
    loadPersistentSettings();
    console.log('Lofi player boot. Enabled in cache:', isPlayerEnabled);

    if (config.youtube.enabled) {
        loadYouTubeAPI();
        // Resume any pending downloads after a short delay
        setTimeout(() => {
            if (cachedYouTubePlaylist.length > 0) {
                resumePendingDownloads();
            }
        }, 2000);
    }

    if (isPlayerEnabled || config.enableLofi) {
        // Auto-activate UI and logic; playback still waits for interaction
        activateLofiPlayer();
    } else {
        // Show activation CTA only when disabled
        createActivationButton();
    }
});

// Update now playing display
const updateNowPlaying = (text) => {
    const nowPlaying = document.getElementById('now-playing');
    if (nowPlaying) {
        nowPlaying.textContent = text;
    }
};

// Update mode buttons (will be called from modal)
const updateModeButtons = () => {
    const localBtn = document.getElementById('local-mode-btn');
    const youtubeBtn = document.getElementById('youtube-mode-btn');
    
    if (localBtn && youtubeBtn) {
        if (isYouTubeMode) {
            localBtn.style.background = 'var(--secondary-color, #0c4061)';
            youtubeBtn.style.background = 'var(--primary-color, #2c4c7c)';
        } else {
            localBtn.style.background = 'var(--primary-color, #2c4c7c)';
            youtubeBtn.style.background = 'var(--secondary-color, #0c4061)';
        }
    }
};

// Setup listeners for user interaction to enable autoplay
const setupAutoStartListeners = () => {
    const startOnInteraction = () => {
        console.log('User interaction detected - starting playback');
        startPlayback();
        // Remove listeners after first interaction
        document.removeEventListener('click', startOnInteraction);
        document.removeEventListener('keydown', startOnInteraction);
        document.removeEventListener('touchstart', startOnInteraction);
    };

    // Add listeners for various interaction types
    document.addEventListener('click', startOnInteraction, { once: true });
    document.addEventListener('keydown', startOnInteraction, { once: true });
    document.addEventListener('touchstart', startOnInteraction, { once: true });
    
    console.log('Waiting for user interaction to start playback...');
    
    // Also try to initialize song list immediately for UI display
    initializeSongList();
};

// Initialize song list without starting playbook (for UI population)
const initializeSongList = async () => {
    try {
        console.log('🔄 Initializing song list...');
        const files = await scanFolderForMP3s();
        if (files && files.length > 0) {
            songList = files;
            console.log('📁 Song list loaded:', songList.length, 'songs');
            
            // Initialize playlist based on shuffle mode
            if (config.shuffle) {
                createShuffledPlaylist();
            }
            
            console.log('✅ Songs ready for playback');
            return songList;
        } else if (manualSongList.length > 0) {
            songList = [...manualSongList];
            console.log('📝 Using manual song list:', songList.length, 'songs');
            
            if (config.shuffle) {
                createShuffledPlaylist();
            }
            
            console.log('✅ Manual songs ready for playback');
            return songList;
        } else {
            console.log('❌ No songs found in folder or manual list');
            throw new Error('No songs available');
        }
    } catch (error) {
        console.error('Failed to initialize song list:', error);
        if (manualSongList.length > 0) {
            songList = [...manualSongList];
            console.log('📝 Fallback to manual song list');
            return songList;
        }
        throw error;
    }
};

// Enhanced clear all caches function
const clearAllCaches = async () => {
    try {
        // Clear all storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear IndexedDB
        if ('indexedDB' in window) {
            const databases = await indexedDB.databases?.() || [];
            await Promise.all(
                databases.map(db => {
                    return new Promise((resolve, reject) => {
                        const deleteReq = indexedDB.deleteDatabase(db.name);
                        deleteReq.onerror = () => reject(deleteReq.error);
                        deleteReq.onsuccess = () => resolve();
                    });
                })
            );
        }

        // Clear Service Worker caches
        if ('serviceWorker' in navigator && 'caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(name => caches.delete(name))
            );
        }

        // Clear cookies for current domain
        document.cookie.split(";").forEach(cookie => {
            const eqPos = cookie.indexOf("=");
            const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
        });

        console.log('All caches and storage cleared successfully');
        return true;
    } catch (error) {
        console.error('Error clearing caches:', error);
        return false;
    }
};

// Initialize Web Audio API
const initializeAudioContext = () => {
    if (!audioContext || audioContext.state === 'closed') {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create audio nodes
            source = audioContext.createMediaElementSource(audioPlayer);
            gainNode = audioContext.createGain();
            analyser = audioContext.createAnalyser();

            // Connect the audio graph
            source.connect(gainNode);
            gainNode.connect(analyser);
            analyser.connect(audioContext.destination);

            // Configure analyser
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = 0.8;

            console.log('🎛️ Audio normalization initialized');
            
            // Resume audio context if suspended (required for user interaction policy)
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('Audio context resumed');
                }).catch(err => {
                    console.warn('Failed to resume audio context:', err);
                });
            }
        } catch (error) {
            console.error('Failed to initialize audio context:', error);
            // Disable normalization if Web Audio API fails
            config.normalization.enabled = false;
        }
    }
};

// Calculate RMS (Root Mean Square) for loudness estimation
const calculateRMS = (audioBuffer) => {
    const channelData = audioBuffer.getChannelData(0);
    let sum = 0;

    for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
    }

    return Math.sqrt(sum / channelData.length);
};

// Analyze audio loudness using Web Audio API
const analyzeAudioLoudness = (audioElement, duration = config.normalization.analysisTime) => {
    return new Promise((resolve) => {
        if (!config.normalization.enabled) {
            resolve(1.0); // No normalization
            return;
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const samples = [];
        let sampleCount = 0;
        const maxSamples = Math.floor(duration / 50); // Sample every 50ms

        const analyzeSample = () => {
            if (audioElement.paused || audioElement.ended || sampleCount >= maxSamples) {
                // Calculate average RMS
                if (samples.length === 0) {
                    resolve(1.0);
                    return;
                }

                const avgRMS = samples.reduce((a, b) => a + b, 0) / samples.length;

                // Convert to approximate LUFS and calculate gain
                // This is a rough approximation. For precise LUFS, a dedicated library is better.
                const estimatedLUFS = 20 * Math.log10(avgRMS) - 23;
                const targetGain = Math.pow(10, (config.normalization.targetLoudness - estimatedLUFS) / 20);

                // Clamp gain to reasonable limits (0.1x to 3x)
                const clampedGain = Math.max(0.1, Math.min(3.0, targetGain));

                console.log(`📊 Audio analysis: RMS=${avgRMS.toFixed(4)}, Est.LUFS=${estimatedLUFS.toFixed(1)}, Gain=${clampedGain.toFixed(2)}x`);
                resolve(clampedGain);
                return;
            }

            analyser.getByteFrequencyData(dataArray);

            // Convert to RMS
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                const normalized = dataArray[i] / 255.0; // Normalize byte to 0-1 range
                sum += normalized * normalized;
            }
            const rms = Math.sqrt(sum / dataArray.length);

            if (rms > 0.001) { // Only include non-silent samples
                samples.push(rms);
            }

            sampleCount++;
            setTimeout(analyzeSample, 50);
        };

        // Start analysis after a short delay to let audio start playing
        setTimeout(analyzeSample, 100);
    });
};

// Create shuffled playlist
const createShuffledPlaylist = () => {
    shuffledPlaylist = [...songList];
    
    // Fisher-Yates shuffle algorithm
    for (let i = shuffledPlaylist.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledPlaylist[i], shuffledPlaylist[j]] = [shuffledPlaylist[j], shuffledPlaylist[i]];
    }
    
    currentPlaylistIndex = 0;
    console.log('🔀 Created shuffled playlist:', shuffledPlaylist);
};

// Create a shuffled playlist where the provided currentSong stays at position 0,
// and the pointer (currentPlaylistIndex) points to the next song to be played.
const createShuffledPlaylistAnchored = (currentSong) => {
    if (!currentSong || !songList.includes(currentSong)) {
        return createShuffledPlaylist();
    }
    const others = songList.filter(s => s !== currentSong);
    // Fisher-Yates shuffle for the remaining songs
    for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
    }
    shuffledPlaylist = [currentSong, ...others];
    // Since currentSong (index 0) is already playing, the next to return is index 1
    currentPlaylistIndex = 1;
    console.log('🔀 Created anchored shuffled playlist:', shuffledPlaylist);
};

// Get next song based on current mode
const getNextSong = () => {
    if (songList.length === 0) return null;

    if (config.shuffle) {
        // Shuffle mode - use shuffled playlist
        if (shuffledPlaylist.length === 0 || currentPlaylistIndex >= shuffledPlaylist.length) {
            // Create new shuffled playlist or restart
            if (config.repeat === 'all' || shuffledPlaylist.length === 0) {
                createShuffledPlaylist();
            } else if (config.repeat === false) {
                // End of playlist, no repeat
                return null;
            }
        }
        
        if (currentPlaylistIndex < shuffledPlaylist.length) {
            const song = shuffledPlaylist[currentPlaylistIndex];
            currentPlaylistIndex++;
            return song;
        }
    } else {
        // Sequential mode
        if (currentSongIndex === -1) {
            // First song
            currentSongIndex = 0;
        } else {
            currentSongIndex++;
            
            if (currentSongIndex >= songList.length) {
                if (config.repeat === 'all') {
                    currentSongIndex = 0; // Restart playlist
                } else if (config.repeat === false) {
                    // End of playlist
                    return null;
                } else {
                    currentSongIndex = songList.length - 1; // Stay on last song for 'one' mode
                }
            }
        }
        
        return songList[currentSongIndex];
    }
    
    return null;
};

// Get previous song based on current mode
const getPreviousSong = () => {
    if (songList.length === 0) return null;

    if (config.shuffle) {
        // Pointer semantics: getNextSong returns shuffledPlaylist[currentPlaylistIndex] then increments.
        // The currently playing item is at index currentPlaylistIndex - 1.
        if (shuffledPlaylist.length === 0) return null;
        if (currentPlaylistIndex > 1) {
            // Move pointer back two so next call returns previous item
            currentPlaylistIndex -= 2;
            return getNextSong();
        } else {
            if (config.repeat === 'all') {
                // Wrap to the last item
                currentPlaylistIndex = shuffledPlaylist.length - 1;
                return getNextSong();
            } else {
                // Stay at the first item
                currentPlaylistIndex = Math.max(1, currentPlaylistIndex);
                return shuffledPlaylist[0];
            }
        }
    } else {
        // Sequential mode
        if (currentSongIndex > 0) {
            currentSongIndex--;
        } else if (config.repeat === 'all') {
            currentSongIndex = songList.length - 1; // Go to last song
        } else {
            currentSongIndex = 0; // Stay at first song
        }
        
        return songList[currentSongIndex];
    }
};

// Main playback starter
const startPlayback = () => {
    if (isPlaying && !savedPlaybackState) return; // Prevent multiple starts if already playing and not resuming

    // Strict mode separation: only play local files in local mode
    if (isYouTubeMode) {
        console.log('MODE: In YouTube mode - local file playback blocked. Switch to Local mode first.');
        return;
    }

    console.log('Starting local playback...');

    // Initialize audio context on user interaction
    initializeAudioContext();

    // Check if songs are already loaded
    if (songList.length > 0) {
        console.log('📁 Songs already loaded, starting playback with', songList.length, 'songs');
        
        // Ensure playlist is initialized
        if (config.shuffle && shuffledPlaylist.length === 0) {
            createShuffledPlaylist();
        }
        
        handleInitialSongLoad();
        isPlaying = true;
        return;
    }

    // Try folder scanning if songs not loaded yet
    scanFolderForMP3s()
        .then((files) => {
            if (files && files.length > 0) {
                songList = files;
                console.log('📁 Scanned folder, found', songList.length, 'songs:', songList);
                
                // Initialize playlist based on shuffle mode
                if (config.shuffle) {
                    createShuffledPlaylist();
                }
                
                handleInitialSongLoad();
                isPlaying = true;
            } else {
                // Fallback to manual list
                if (manualSongList.length > 0) {
                    console.log('📝 Using manual song list:', manualSongList);
                    songList = [...manualSongList];
                    
                    // Initialize playlist based on shuffle mode
                    if (config.shuffle) {
                        createShuffledPlaylist();
                    }
                    
                    handleInitialSongLoad();
                    isPlaying = true;
                } else {
                    console.log('❌ No songs found! Either:');
                    console.log('1. Add MP3 or WAV files to the lofi/ folder, OR');
                    console.log('2. Add filenames to the manualSongList array in the code');
                    console.log('Current folder path:', config.folder);
                }
            }
        })
        .catch((error) => {
            console.error('Folder scan failed:', error);

            // Try manual list as fallback
            if (manualSongList.length > 0) {
                console.log('📝 Folder scan failed, using manual list');
                songList = [...manualSongList];
                
                // Initialize playlist based on shuffle mode
                if (config.shuffle) {
                    createShuffledPlaylist();
                }
                
                handleInitialSongLoad();
                isPlaying = true;
            } else {
                console.error('❌ No fallback available. Add songs to manualSongList array.');
            }
        });
};

// Handles loading the first song, either from persistence or based on mode
const handleInitialSongLoad = () => {
    if (config.persistence.enabled && savedPlaybackState && savedPlaybackState.currentSong) {
    const savedSongName = safeDecode(savedPlaybackState.currentSong.split('/').pop().split('?')[0]);
        
        // Validate that saved song still exists in current song list
        if (songList.includes(savedSongName)) {
            const fullSavedPath = buildSongPath(savedSongName);
            console.log(`Attempting to load saved song: ${savedSongName} at ${savedPlaybackState.currentTime.toFixed(1)}s`);
            
            // Set current indices based on saved song
            const savedIndex = songList.indexOf(savedSongName);
            currentSongIndex = savedIndex;
            
            if (config.shuffle && shuffledPlaylist.length > 0) {
                const shuffledIndex = shuffledPlaylist.indexOf(savedSongName);
                if (shuffledIndex !== -1) {
                    currentPlaylistIndex = shuffledIndex + 1; // +1 because it will be used for next song
                }
            }
            
            loadAndPlay(fullSavedPath, savedSongName, savedPlaybackState.currentTime, savedPlaybackState.volume, savedPlaybackState.isPlaying);
        } else {
            console.log('Saved song no longer available, starting fresh playlist');
            playNextSong();
        }
        
        // Clear saved state after attempting to load it
        savedPlaybackState = null;
    } else {
        playNextSong(); // Use the new mode-aware function
    }
};

// Scan folder for audio files (MP3 and WAV)
const scanFolderForMP3s = async () => {
    try {
        console.log('🔍 Scanning folder for audio files:', config.folder);

    const response = await fetch(config.folder);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Cannot access folder`);
        }

        const html = await response.text();

        // Parse the directory listing HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Look for audio file links in different formats
        let audioLinks = [];

        // Try common directory listing formats for both MP3 and WAV
        const linkSelectors = [
            'a[href$=".mp3"], a[href$=".wav"]', // Direct audio links
            'a[href*=".mp3"], a[href*=".wav"]', // Contains audio extensions
            'a[href$=".MP3"], a[href$=".WAV"]', // Uppercase
            'a[href*=".MP3"], a[href*=".WAV"]' // Uppercase contains
        ];

        for (const selector of linkSelectors) {
            const links = doc.querySelectorAll(selector);
            if (links.length > 0) {
                audioLinks = Array.from(links);
                break;
            }
        }

        // Extract filenames
        const files = audioLinks.map((link) => {
            let href = link.getAttribute('href');

            // Clean up the href
            if (href.startsWith('/')) {
                href = href.substring(1);
            }

            // Get just the filename
            const filename = safeDecode(href.split('/').pop().split('?')[0]);

            return filename;
        }).filter(filename => {
            const lower = filename.toLowerCase();
            return (lower.endsWith('.mp3') || lower.endsWith('.wav')) &&
                filename !== '' &&
                !filename.includes('..'); // Security: no parent directory access
        });

        console.log('🎵 Found audio files:', files);
        return files;

    } catch (error) {
        console.warn('Folder scanning failed:', error.message);

        // Try alternative method: attempt to load common index files
        try {
            const indexResponse = await fetch(config.folder + 'index.json');
            if (indexResponse.ok) {
                const indexData = await indexResponse.json();
                if (Array.isArray(indexData)) {
                    console.log('📋 Using index.json file list');
                    return indexData.filter(f => {
                        const lower = f.toLowerCase();
                        return lower.endsWith('.mp3') || lower.endsWith('.wav');
                    });
                }
            }
        } catch (e) {
            // Index.json doesn't exist, that's fine
        }

        throw error;
    }
};

// Play next song with mode awareness
const playNextSong = (initiator = 'user') => {
    // Strict mode separation: only play local files in local mode
    if (isYouTubeMode) {
        console.log('MODE: In YouTube mode - local files blocked. Switch to Local mode first.');
        return;
    }
    
    if (songList.length === 0) {
        console.log('No local songs available');
        return;
    }

    // Handle repeat one mode
    if (initiator === 'auto' && config.repeat === 'one' && audioPlayer.src) {
        // Repeat current song only for auto-advance
    const currentSong = safeDecode(audioPlayer.src.split('/').pop().split('?')[0]);
        try {
            audioPlayer.currentTime = 0;
            // Ensure ended handler is attached again (the previous one was once-only)
            audioPlayer.addEventListener('ended', handleSongEnded, { once: true });
            audioPlayer.play().then(() => {
                isPlaying = true;
                updateUIForPlaying(decodeURIComponent(currentSong));
                console.log('🔂 Repeating current song (auto)');
            }).catch(err => {
                console.warn('Repeat-one auto play() failed, reloading track:', err);
                // Fallback: reload the same track via loadAndPlay
                const songPath = buildSongPath(currentSong);
                loadAndPlay(songPath, currentSong);
            });
        } catch (e) {
            console.warn('Repeat-one auto failed; trying reload:', e);
            const currentSong = safeDecode(audioPlayer.src.split('/').pop().split('?')[0]);
            const songPath = buildSongPath(currentSong);
            loadAndPlay(songPath, currentSong);
        }
        return;
    }

    if (isTransitioning) {
        console.log('⏳ Transition in progress, ignoring next');
        return;
    }
    isTransitioning = true;

    const nextSong = getNextSong();
    
    if (!nextSong) {
        console.log('📻 End of playlist reached');
        isPlaying = false;
        // Update UI
        const nowPlayingDiv = document.getElementById('now-playing');
        if (nowPlayingDiv) nowPlayingDiv.textContent = 'Playlist ended.';
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
        return;
    }

    const songPath = buildSongPath(nextSong);

    console.log('▶ Playing:', nextSong, `(${config.shuffle ? 'shuffle' : 'sequential'} mode)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlay(songPath, nextSong);
        });
    } else {
        loadAndPlay(songPath, nextSong);
    }
};

// Play previous song
const playPreviousSong = () => {
    // Strict mode separation: only play local files in local mode
    if (isYouTubeMode) {
        console.log('MODE: In YouTube mode - local files blocked. Switch to Local mode first.');
        return;
    }
    
    if (songList.length === 0) {
        console.log('No local songs available');
        return;
    }

    if (isTransitioning) {
        console.log('⏳ Transition in progress, ignoring previous');
        return;
    }
    isTransitioning = true;

    const previousSong = getPreviousSong();
    
    if (!previousSong) {
        console.log('📻 At beginning of playlist');
        isTransitioning = false;
        return;
    }

    const songPath = buildSongPath(previousSong);

    console.log('⏮ Previous:', previousSong, `(${config.shuffle ? 'shuffle' : 'sequential'} mode)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlay(songPath, previousSong);
        });
    } else {
        loadAndPlay(songPath, previousSong);
    }
};

// Legacy function for compatibility - now uses mode-aware playback
const playRandomSong = () => {
    playNextSong();
};

// Load and play new song with fade in and normalization
const loadAndPlay = (songPath, songName, startTime = 0, initialVolume = 0, shouldPlay = true) => {
    // Clean up any existing event listeners
    audioPlayer.removeEventListener('ended', handleSongEnded);
    
    audioPlayer.src = songPath;
    audioPlayer.volume = initialVolume; // Start at 0 or the saved initialVolume for fade in

    // Check cache for normalization data
    const cacheKey = songName;
    let cachedGain = null;

    if (config.normalization.cache && normalizationCache.has(cacheKey)) {
        cachedGain = normalizationCache.get(cacheKey);
        console.log('📦 Using cached normalization for:', songName, `(${cachedGain.toFixed(2)}x)`);
    }

    audioPlayer.currentTime = startTime; // Set playback position
    isPlaying = shouldPlay; // Update global state

    // If starting from scratch (or resuming a paused state), try to play
    if (shouldPlay) {
        audioPlayer.play()
            .then(() => {
                console.log('🎵 Now playing:', songName);

                // Update UI immediately (moved here from event listener for quicker response)
                updateUIForPlaying(songName);

                // Initialize Web Audio API if needed (only when actually playing)
                if (config.normalization.enabled && !audioContext) {
                    initializeAudioContext();
                }

                if (cachedGain !== null && gainNode) {
                    // Use cached gain immediately
                    gainNode.gain.setValueAtTime(cachedGain, audioContext.currentTime);
                    fadeIn(audioPlayer);
                } else {
                    // Start with default gain and analyze
                    if (gainNode) {
                        gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
                    }
                    fadeIn(audioPlayer);

                    // Analyze and adjust gain
                    if (config.normalization.enabled && analyser) {
                        analyzeAudioLoudness(audioPlayer)
                            .then((normalizedGain) => {
                                // Cache the result
                                if (config.normalization.cache) {
                                    normalizationCache.set(cacheKey, normalizedGain);
                                    saveNormalizationCache(); // Save cache after update
                                }

                                // Apply the gain gradually to avoid sudden volume changes
                                if (gainNode) {
                                    gainNode.gain.exponentialRampToValueAtTime(
                                        normalizedGain,
                                        audioContext.currentTime + 0.5
                                    );
                                }
                            })
                            .catch(error => {
                                console.warn('Normalization analysis failed:', error);
                            });
                    }
                }

                // Setup next song when current ends
                audioPlayer.addEventListener('ended', handleSongEnded, { once: true });

                // Clear transition guard now that playback started
                isTransitioning = false;

            })
            .catch((error) => {
                console.error('❌ Playback promise failed for:', songName, error);
                handleFailedSong(songName);
                isTransitioning = false;
            });
            
        // Also add a general error listener for the audio element
        audioPlayer.addEventListener('error', (e) => {
            console.error('❌ Audio element error for:', songName, e);
            handleFailedSong(songName);
            isTransitioning = false;
        }, { once: true });
    } else {
        // If not supposed to play (e.g., loaded a paused state)
        audioPlayer.pause();
        updateUIForPaused(songName);
        isTransitioning = false;
    }
};

// Helper function for 'ended' event listener
const handleSongEnded = () => {
    console.log('Song ended, playing next...');
    // Reduced delay from 500ms to 100ms for much faster transitions
    setTimeout(() => playNextSong('auto'), 100);
};

// Helper function to handle failed songs
const handleFailedSong = (songName) => {
    // Update UI to reflect error
    const nowPlayingDiv = document.getElementById('now-playing');
    if (nowPlayingDiv) nowPlayingDiv.textContent = `Error playing: ${songName}`;

    // Remove failed song and update indices properly
    const originalIndex = songList.indexOf(songName);
    songList = songList.filter(song => song !== songName);
    
    // Update current song index if the failed song was before current position
    if (originalIndex !== -1 && originalIndex <= currentSongIndex) {
        currentSongIndex = Math.max(0, currentSongIndex - 1);
    }
    
    // Also remove from shuffled playlist
    if (config.shuffle) {
        const shuffledIndex = shuffledPlaylist.indexOf(songName);
        shuffledPlaylist = shuffledPlaylist.filter(song => song !== songName);
        
        // Update playlist index if the failed song was before current position
        if (shuffledIndex !== -1 && shuffledIndex < currentPlaylistIndex) {
            currentPlaylistIndex = Math.max(0, currentPlaylistIndex - 1);
        }
    }
    
    // Remove from normalization cache
    const cacheKey = songName;
    normalizationCache.delete(cacheKey);
    console.log('Removed failed song, remaining:', songList.length);

    if (songList.length > 0) {
        setTimeout(playNextSong, 200);
    } else {
        console.error('No more songs to play!');
        isPlaying = false;
        updateUIForStopped();
    }
};

// Helper function to update UI for playing state
const updateUIForPlaying = (songName) => {
    const nowPlayingDiv = document.getElementById('now-playing');
    if (nowPlayingDiv) {
        nowPlayingDiv.textContent = `Now Playing: ${safeDecode(songName)}`;
    }
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.textContent = '⏸ Pause';
        playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
    }
    
    // Update song selector - make sure it's populated first
    const songSelector = document.getElementById('song-selector');
    if (songSelector) {
        // First ensure the song is in the selector options
        const songOption = Array.from(songSelector.options).find(option => option.value === songName);
        if (!songOption && songList.includes(songName)) {
            // Repopulate the selector if the song isn't found
            populateSongSelector();
        }
        // Now set the value
        songSelector.value = songName;
        console.log('🎵 Updated song selector to:', songName);
    }
};

// Helper function to update UI for paused state
const updateUIForPaused = (songName) => {
    const nowPlayingDiv = document.getElementById('now-playing');
    if (nowPlayingDiv) nowPlayingDiv.textContent = `Paused: ${safeDecode(songName)}`;
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.textContent = '▶ Play';
        playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
    }
};

// Helper function to update UI for stopped state
const updateUIForStopped = () => {
    const nowPlayingDiv = document.getElementById('now-playing');
    if (nowPlayingDiv) nowPlayingDiv.textContent = 'Stopped.';
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.textContent = '▶ Play';
        playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
    }
};

// Fade effects
const fadeOut = (audio, callback) => {
    const fadeSteps = 10; // Reduced from 20 to 10 for faster fade
    const stepTime = config.fadeDuration / fadeSteps;
    const initialVolume = audio.volume;
    const stepVolume = initialVolume / fadeSteps; // Calculate step volume based on current volume

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = initialVolume - (stepVolume * currentStep);
        if (newVolume > 0) {
            audio.volume = newVolume;
        } else {
            audio.volume = 0;
            audio.pause();
            clearInterval(fadeInterval);
            if (callback) callback();
        }
    }, stepTime);
};

const fadeIn = (audio) => {
    const fadeSteps = 10; // Reduced from 20 to 10 for faster fade
    const stepTime = config.fadeDuration / fadeSteps;
    const targetVolume = config.volume; // Use the configured volume as the target
    const stepVolume = targetVolume / fadeSteps;
    audio.volume = 0;

    let currentStep = 0;
    const fadeInterval = setInterval(() => {
        currentStep++;
        const newVolume = stepVolume * currentStep;
        if (newVolume < targetVolume) {
            audio.volume = newVolume;
        } else {
            audio.volume = targetVolume;
            clearInterval(fadeInterval);
        }
    }, stepTime);
};

const savePlayerState = () => {
    if (!config.persistence.enabled) return;

    const state = {
        currentSong: audioPlayer.src,
        currentTime: audioPlayer.currentTime,
        volume: audioPlayer.volume,
        isPlaying: isPlaying,
        configVolume: config.volume,
        shuffle: config.shuffle,
        repeat: config.repeat,
        currentSongIndex: currentSongIndex,
        currentPlaylistIndex: currentPlaylistIndex,
        normalizationEnabled: config.normalization.enabled,
        targetLoudness: config.normalization.targetLoudness,
        lastUpdated: new Date().toISOString() // Add timestamp for debugging
    };
    
    try {
        localStorage.setItem(config.persistence.localStorageKey, JSON.stringify(state));
        console.log('💾 Player state saved:', state);
    } catch (e) {
        console.error('Error saving player state to localStorage:', e);
    }
};

const loadPlayerState = () => {
    if (!config.persistence.enabled) return;

    try {
        const savedStateString = localStorage.getItem(config.persistence.localStorageKey);
        if (savedStateString) {
            savedPlaybackState = JSON.parse(savedStateString);
            config.volume = savedPlaybackState.configVolume || config.volume;
            config.shuffle = savedPlaybackState.shuffle !== undefined ? savedPlaybackState.shuffle : config.shuffle;
            config.repeat = savedPlaybackState.repeat !== undefined ? savedPlaybackState.repeat : config.repeat;
            currentSongIndex = savedPlaybackState.currentSongIndex || -1;
            currentPlaylistIndex = savedPlaybackState.currentPlaylistIndex || -1;
            config.normalization.enabled = savedPlaybackState.normalizationEnabled !== undefined ? savedPlaybackState.normalizationEnabled : config.normalization.enabled;
            config.normalization.targetLoudness = savedPlaybackState.targetLoudness || config.normalization.targetLoudness;

            audioPlayer.volume = savedPlaybackState.volume; // Apply initial volume

            // Update UI elements from loaded config will be handled by modal script
            console.log('✅ Player state loaded:', savedPlaybackState);
        }
    } catch (e) {
        console.error('Error loading player state from localStorage:', e);
        savedPlaybackState = null; // Clear corrupted state
    }
};

const saveNormalizationCache = () => {
    if (!config.persistence.enabled || !config.normalization.cache) return;
    try {
        // Limit cache size to prevent excessive localStorage usage
        const maxCacheSize = 100; // Limit to 100 songs
        if (normalizationCache.size > maxCacheSize) {
            // Remove oldest entries
            const entries = Array.from(normalizationCache.entries());
            const keptEntries = entries.slice(-maxCacheSize);
            normalizationCache = new Map(keptEntries);
            console.log(`📦 Trimmed normalization cache to ${maxCacheSize} entries`);
        }
        
        // Convert Map to array of [key, value] pairs for JSON stringification
        const cacheArray = Array.from(normalizationCache.entries());
        localStorage.setItem(config.persistence.normalizationCacheKey, JSON.stringify(cacheArray));
        console.log('💾 Normalization cache saved with', normalizationCache.size, 'entries.');
    } catch (e) {
        console.error('Error saving normalization cache to localStorage:', e);
        // If localStorage is full, clear some old data
        if (e.name === 'QuotaExceededError') {
            try {
                normalizationCache.clear();
                localStorage.setItem(config.persistence.normalizationCacheKey, JSON.stringify([]));
                console.log('🗑️ Cleared normalization cache due to storage quota exceeded');
            } catch (e2) {
                console.error('Could not clear normalization cache:', e2);
            }
        }
    }
};

const loadNormalizationCache = () => {
    if (!config.persistence.enabled || !config.normalization.cache) return;
    try {
        const cachedData = localStorage.getItem(config.persistence.normalizationCacheKey);
        if (cachedData) {
            const cacheArray = JSON.parse(cachedData);
            // Validate cache entries
            const validEntries = cacheArray.filter(([key, value]) => 
                typeof key === 'string' && 
                typeof value === 'number' && 
                value > 0 && value <= 10 // Reasonable gain range
            );
            normalizationCache = new Map(validEntries);
            console.log('✅ Normalization cache loaded with', normalizationCache.size, 'valid entries.');
            
            // Save cleaned cache if we filtered out invalid entries
            if (validEntries.length !== cacheArray.length) {
                saveNormalizationCache();
            }
        }
    } catch (e) {
        console.error('Error loading normalization cache from localStorage:', e);
        normalizationCache = new Map(); // Clear corrupted cache
        // Clear the corrupted data
        try {
            localStorage.removeItem(config.persistence.normalizationCacheKey);
        } catch (e2) {
            console.error('Could not clear corrupted cache:', e2);
        }
    }
};

// Manual controls
window.lofi = {
    skip: playNextSong,
    next: playNextSong,
    previous: playPreviousSong,
    // Debug function to manually initialize songs
    initSongs: initializeSongList,
    // Debug function to get current state
    debug: () => {
        console.log('🔍 Debug Info:');
        console.log('Songs loaded:', songList.length);
        console.log('Songs:', songList);
        console.log('Is playing:', isPlaying);
        console.log('Audio source:', audioPlayer.src);
        console.log('Audio paused:', audioPlayer.paused);
    },
    stop: () => {
        audioPlayer.pause();
        isPlaying = false; // Player is intentionally paused
        console.log('⏹ Stopped');
        // Update UI
        const nowPlayingDiv = document.getElementById('now-playing');
        if (nowPlayingDiv) nowPlayingDiv.textContent = 'Paused.';
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
            playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--secondary-color, #0c4061)';
            playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
    },
     start: () => {
        // If there's a current song and we're paused, resume it
        if (audioPlayer.src && audioPlayer.paused) {
            audioPlayer.play()
                .then(() => {
                    isPlaying = true;
                    console.log('▶ Resumed playback');
                    // Update UI
                    const nowPlayingDiv = document.getElementById('now-playing');
                    if (nowPlayingDiv) {
                        const currentSong = safeDecode(audioPlayer.src.split('/').pop());
                        nowPlayingDiv.textContent = `Now Playing: ${safeDecode(currentSong)}`;
                    }
                    const playPauseBtn = document.getElementById('play-pause-btn');
                    if (playPauseBtn) {
                        playPauseBtn.textContent = '⏸ Pause';
                        playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
                        playPauseBtn.onmouseover = () => playPauseBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
                        playPauseBtn.onmouseout = () => playPauseBtn.style.backgroundColor = 'var(--tertiary-color, #0d9edb)';
                    }
                })
                .catch(error => {
                    console.error('Error resuming playback:', error);
                    // If resume fails, fall back to playing a new song
                    playRandomSong();
                });
        } else if (!audioPlayer.src || audioPlayer.ended) {
            // If no song is loaded or song has ended, start a new one
            playRandomSong();
        }
        // If already playing, do nothing
    },
    volume: (v) => {
        config.volume = Math.max(0, Math.min(1, v));
        audioPlayer.volume = config.volume;
        try {
            if (youtubePlayer && typeof youtubePlayer.setVolume === 'function') {
                youtubePlayer.setVolume(Math.round(config.volume * 100));
            }
        } catch(_) {}
        try {
            if (config.persistence?.enabled) {
                localStorage.setItem(config.persistence.volumeKey, String(config.volume));
            }
        } catch(_) {}
        console.log('🔊 Volume set to:', Math.round(config.volume * 100) + '%');
        // Update UI
        const volumeSlider = document.getElementById('volume-slider');
        const volumeDisplay = document.getElementById('volume-display');
        if (volumeSlider) volumeSlider.value = config.volume;
        if (volumeDisplay) volumeDisplay.textContent = `${Math.round(config.volume * 100)}%`;
    },
    list: () => {
        console.log('Current playlist:', songList);
        console.log('Recently played:', lastPlayedSongs);
    },
    clearHistory: () => {
        lastPlayedSongs = [];
        console.log('🔄 Cleared play history');
    },
    // New normalization controls
    toggleNormalization: () => {
        config.normalization.enabled = !config.normalization.enabled;
        console.log('🎚️ Normalization:', config.normalization.enabled ? 'enabled' : 'disabled');
        // Update UI
        const normToggle = document.getElementById('normalization-toggle');
        const normStatus = document.getElementById('norm-status');
        if (normToggle) normToggle.checked = config.normalization.enabled;
        if (normStatus) {
            normStatus.textContent = `(${config.normalization.enabled ? 'On' : 'Off'})`;
            normStatus.style.color = config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)';
        }
    },
    clearNormalizationCache: () => {
        normalizationCache.clear();
        saveNormalizationCache(); // Also save empty cache
        console.log('🗑️ Normalization cache cleared');
    },
    setTargetLoudness: (lufs) => {
        config.normalization.targetLoudness = Math.max(-40, Math.min(-10, lufs));
        console.log('🎯 Target loudness set to:', config.normalization.targetLoudness, 'LUFS');
        // Update UI
        const targetLufsInput = document.getElementById('target-lufs');
        if (targetLufsInput) targetLufsInput.value = config.normalization.targetLoudness;
    },
    showNormalizationCache: () => {
        console.log('📊 Normalization cache:');
        if (normalizationCache.size === 0) {
            console.log('   (Cache is empty)');
        } else {
            normalizationCache.forEach((gain, song) => {
                console.log(`  ${song}: ${gain.toFixed(2)}x`);
            });
        }
    },
    // New persistence control
    togglePersistence: () => {
        config.persistence.enabled = !config.persistence.enabled;
        console.log('💾 Persistence:', config.persistence.enabled ? 'enabled' : 'disabled');
        if (!config.persistence.enabled) {
            localStorage.removeItem(config.persistence.localStorageKey);
            localStorage.removeItem(config.persistence.normalizationCacheKey);
            console.log('🗑️ All player persistence data cleared from localStorage.');
        }
        // Update UI if a toggle button is added for persistence
    },
};

console.log('🎧 Lofi Player with Normalization and Persistence loaded');
console.log('Manual controls: lofi.skip(), lofi.stop(), lofi.volume(0.5), lofi.list(), lofi.clearHistory()');
console.log('Normalization: lofi.toggleNormalization(), lofi.clearNormalizationCache(), lofi.setTargetLoudness(-23)');
console.log('Persistence: lofi.togglePersistence()');
console.log('YouTube Debug: lofi.debugYouTube()');
console.log('📊 Current normalization target:', config.normalization.targetLoudness, 'LUFS');

// Add debug helper
window.lofi.debugYouTube = async () => {
    console.log('=== YouTube Cache Debug ===');
    console.log('Persistence enabled:', config.persistence?.enabled);
    console.log('Cached playlist length:', cachedYouTubePlaylist.length);
    console.log('Cached playlist:', cachedYouTubePlaylist.map(x => ({...x, title: prettyTitle(x.title)})));
    console.log('LocalStorage key:', config.persistence.youtubePlaylistKey);
    console.log('LocalStorage raw:', localStorage.getItem(config.persistence.youtubePlaylistKey));
    console.log('UI container exists:', !!document.getElementById('youtube-playlist'));
    
    // IndexedDB debug info
    try {
        const dbKeys = await listCachedAudioKeys();
        console.log('IndexedDB cached audio keys:', dbKeys);
        
        // Show detailed info for each cached item
        for (const key of dbKeys) {
            const cached = await getCachedAudioBlob(key);
            console.log(`IndexedDB item ${key}:`, {
                title: prettyTitle(cached?.title),
                status: cached?.status,
                blobSize: cached?.blob?.size,
                cachedAt: cached?.cachedAt
            });
        }
    } catch (error) {
        console.error('IndexedDB debug error:', error);
    }
    
    // Status summary
    const statusCount = cachedYouTubePlaylist.reduce((acc, item) => {
        acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1;
        return acc;
    }, {});
    console.log('Status summary:', statusCount);
};








// --- Modal Creation and Control ---

// Create the floating icon
const createFloatingIcon = () => {
    const icon = document.createElement('div');
    icon.id = 'lofi-player-icon';
    icon.style.position = 'fixed';
    icon.style.bottom = '20px';
    icon.style.left = '20px';
    icon.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
    icon.style.color = 'var(--light-color, #f4f8fc)';
    icon.style.borderRadius = '50%';
    icon.style.width = '50px';
    icon.style.height = '50px';
    icon.style.display = 'flex';
    icon.style.justifyContent = 'center';
    icon.style.alignItems = 'center';
    icon.style.cursor = 'pointer';
    icon.style.zIndex = '1000';
    icon.style.fontFamily = 'monospace';
    icon.style.fontSize = '24px';
    icon.textContent = '🎧'; // Headphones emoji
    icon.title = 'Open Lofi Player Controls';

    document.body.appendChild(icon);
    icon.addEventListener('click', toggleModal);
};

// Update progress bar
const updateProgressBar = () => {
    const progressBar = document.getElementById('progress-bar');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    
    if (progressBar && currentTimeSpan && durationSpan) {
        let currentTime = 0;
        let duration = 0;
        if (isYouTubeMode && youtubePlayer && typeof youtubePlayer.getDuration === 'function') {
            try {
                duration = youtubePlayer.getDuration() || 0;
                currentTime = youtubePlayer.getCurrentTime() || 0;
            } catch(_) {}
        } else if (audioPlayer) {
            currentTime = audioPlayer.currentTime || 0;
            duration = audioPlayer.duration || 0;
        }
        
        if (duration > 0) {
            const progress = (currentTime / duration) * 100;
            progressBar.value = progress;
            currentTimeSpan.textContent = formatTime(currentTime);
            durationSpan.textContent = formatTime(duration);
        }
    }
};

// Format time in MM:SS format
const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Handle progress bar click
const handleProgressBarClick = (e) => {
    const progressBar = e.target;
    const rect = progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = (clickX / rect.width) * 100;
    
    if (isYouTubeMode && youtubePlayer && typeof youtubePlayer.getDuration === 'function') {
        const dur = youtubePlayer.getDuration();
        if (dur && dur > 0) {
            const newTime = (percentage / 100) * dur;
            try { youtubePlayer.seekTo(newTime, true); } catch(_) {}
            progressBar.value = percentage;
        }
    } else if (audioPlayer && audioPlayer.duration) {
        const newTime = (percentage / 100) * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
        progressBar.value = percentage;
    }
};

// Populate song selector dropdown
const populateSongSelector = () => {
    const songSelector = document.getElementById('song-selector');
    if (songSelector) {
        if (songList && songList.length > 0) {
            songSelector.innerHTML = '<option value="">Select a song...</option>';
            
            songList.forEach((song, index) => {
                const option = document.createElement('option');
                option.value = song;
                option.textContent = safeDecode(song);
                songSelector.appendChild(option);
            });
            console.log('📋 Song selector populated with', songList.length, 'songs');
        } else {
            songSelector.innerHTML = '<option value="">Loading songs...</option>';
            console.log('📋 Song selector shows loading state');
        }
    }
};

// Handle song selection from dropdown
const handleSongSelection = (selectedSong) => {
    if (isTransitioning) {
        console.log('⏳ Transition in progress, ignoring selection');
        return;
    }
    if (selectedSong && songList.includes(selectedSong)) {
        // Switch to local mode if in YouTube mode
        if (isYouTubeMode) {
            if (youtubePlayer) {
                youtubePlayer.pauseVideo();
            }
            isYouTubeMode = false;
            updateModeButtons();
        }
        
        // Update indices
        currentSongIndex = songList.indexOf(selectedSong);
        if (config.shuffle) {
            createShuffledPlaylistAnchored(selectedSong);
        } else {
            currentPlaylistIndex = -1;
        }
    const songPath = buildSongPath(selectedSong);
        isTransitioning = true;
        loadAndPlay(songPath, selectedSong, 0, 0, true);
    }
};

// Toggle play/pause with strict mode separation
const togglePlayPause = () => {
    if (isYouTubeMode) {
        // YouTube mode: only control YouTube content
        if (youtubePlayer) {
            try {
                const playerState = youtubePlayer.getPlayerState();
                if (playerState === YT.PlayerState.PLAYING) {
                    youtubePlayer.pauseVideo();
                    isPlaying = false;
                } else {
                    youtubePlayer.playVideo();
                    isPlaying = true;
                }
            } catch (e) {
                console.log('YouTube player not ready, checking audio player for cached content');
                // Handle cached YouTube content playing through audioPlayer
                if (audioPlayer.paused) {
                    if (audioPlayer.src) {
                        audioPlayer.play().catch(err => console.error('Cached YouTube play failed:', err));
                        isPlaying = true;
                    } else {
                        console.log('No YouTube content loaded - add a YouTube URL first');
                    }
                } else {
                    audioPlayer.pause();
                    isPlaying = false;
                }
            }
        } else {
            // Handle cached YouTube content playing through audioPlayer
            if (audioPlayer.paused) {
                if (audioPlayer.src) {
                    audioPlayer.play().catch(err => console.error('Cached YouTube play failed:', err));
                    isPlaying = true;
                } else {
                    console.log('No YouTube content loaded - add a YouTube URL first');
                }
            } else {
                audioPlayer.pause();
                isPlaying = false;
            }
        }
    } else {
        // Local mode: only control local audio files
        if (audioPlayer.paused) {
            if (audioPlayer.src && !audioPlayer.src.startsWith('blob:')) {
                // Only play if it's a local file, not a blob (cached YouTube)
                audioPlayer.play().catch(err => console.error('Local play failed:', err));
                isPlaying = true;
            } else if (!audioPlayer.src) {
                // No song loaded, start local playback
                startPlayback();
            } else {
                console.log('Cached YouTube content detected in Local mode - switch to YouTube mode to play');
            }
        } else {
            audioPlayer.pause();
            isPlaying = false;
        }
    }
};

// Stop playback for both modes
const stopPlayback = () => {
    if (isYouTubeMode && youtubePlayer) {
        youtubePlayer.stopVideo();
    } else {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    isPlaying = false;
    updateNowPlaying('Stopped');
};

// Toggle shuffle mode
const toggleShuffle = () => {
    config.shuffle = !config.shuffle;
    const shuffleBtn = document.getElementById('shuffle-btn');
    if (shuffleBtn) {
        shuffleBtn.textContent = config.shuffle ? '🔀 Shuffle: On' : '🔀 Shuffle: Off';
        shuffleBtn.style.backgroundColor = config.shuffle ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)';
    }
    // Rebuild playlist state anchored to current song
    const currentSong = audioPlayer.src ? audioPlayer.src.split('/').pop().split('?')[0] : null;
    if (config.shuffle) {
        if (currentSong && songList.includes(currentSong)) {
            createShuffledPlaylistAnchored(currentSong);
        } else if (songList.length) {
            createShuffledPlaylist();
        }
    } else {
        // Switching to sequential: align index to current song
        if (currentSong && songList.includes(currentSong)) {
            currentSongIndex = songList.indexOf(currentSong);
        } else {
            currentSongIndex = -1;
        }
        currentPlaylistIndex = -1;
    }
};

// Toggle repeat mode
const toggleRepeat = () => {
    if (!config.repeat) {
        config.repeat = 'one';
    } else if (config.repeat === 'one') {
        config.repeat = 'all';
    } else {
        config.repeat = false;
    }
    
    const repeatBtn = document.getElementById('repeat-btn');
    if (repeatBtn) {
        if (config.repeat === 'one') {
            repeatBtn.textContent = '🔂 Repeat: One';
            repeatBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
        } else if (config.repeat === 'all') {
            repeatBtn.textContent = '🔁 Repeat: All';
            repeatBtn.style.backgroundColor = 'var(--success-color, #2e8b34)';
        } else {
            repeatBtn.textContent = '🔁 Repeat: Off';
            repeatBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        }
    }
};

// Create the modal
const createLofiModal = () => {
    const modal = document.createElement('div');
    modal.id = 'lofi-player-modal';
    modal.style.position = 'fixed';
    modal.style.bottom = '90px'; // Above the icon
    modal.style.left = '20px';
    modal.style.width = 'auto';
    modal.style.height = 'auto';
    modal.style.minWidth = '380px';
    modal.style.maxWidth = '96vw';
    modal.style.maxHeight = '80vh';
    modal.style.overflowY = 'auto';
    modal.style.overflowX = 'hidden';
    modal.style.boxSizing = 'border-box';
    modal.style.backgroundColor = 'var(--dark-color, #0e1827)';
    modal.style.color = 'var(--light-color, #f4f8fc)';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.5)';
    modal.style.zIndex = '1001';
    modal.style.padding = '15px';
    modal.style.fontFamily = 'Arial, sans-serif';
    modal.style.display = 'none'; // Hidden by default
    modal.style.flexDirection = 'column';
    modal.style.gap = '10px';

    // Make modal draggable
    let isDragging = false;
    let offsetX, offsetY;

    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal || e.target.closest('#modal-header') === e.target) {
            isDragging = true;
            offsetX = e.clientX - modal.getBoundingClientRect().left;
            offsetY = e.clientY - modal.getBoundingClientRect().top;
            modal.style.cursor = 'grabbing';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - modal.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, window.innerHeight - modal.offsetHeight));

        modal.style.left = `${newLeft}px`;
        modal.style.top = `${newTop}px`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        modal.style.cursor = 'grab';
    });

    // Modal Header
    const modalHeader = document.createElement('div');
    modalHeader.id = 'modal-header';
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    modalHeader.style.paddingBottom = '10px';
    modalHeader.style.borderBottom = '1px solid var(--primary-color, #2c4c7c)';
    modalHeader.style.marginBottom = '10px';
    modalHeader.style.cursor = 'grab';
    modalHeader.innerHTML = `
        <h3 style="margin: 0; color: var(--tertiary-color, #0d9edb);">Lofi Player</h3>
        <span id="close-modal" style="cursor: pointer; font-size: 20px; color: var(--light-color, #f4f8fc);">&times;</span>
    `;
    modal.appendChild(modalHeader);

    modalHeader.querySelector('#close-modal').addEventListener('click', toggleModal);

    // Song Search + Selector
    const songSelectorDiv = document.createElement('div');
    songSelectorDiv.style.marginBottom = '10px';
    songSelectorDiv.innerHTML = `
        <label for="song-search" style="display: block; margin-bottom: 5px; color: var(--light-color, #f4f8fc);">Search Songs (any language):</label>
        <input type="text" id="song-search" placeholder="Type to filter, e.g., らくらく安楽死" 
               style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--primary-color, #2c4c7c); background-color: var(--secondary-color, #0c4061); color: var(--light-color, #f4f8fc); margin-bottom: 8px;" />
        <label for="song-selector" style="display: block; margin-bottom: 5px; color: var(--light-color, #f4f8fc);">Select Song:</label>
        <select id="song-selector" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--primary-color, #2c4c7c); background-color: var(--secondary-color, #0c4061); color: var(--light-color, #f4f8fc);">
            <option value="">Select a song...</option>
        </select>
    `;
    modal.appendChild(songSelectorDiv);

    const songSelector = songSelectorDiv.querySelector('#song-selector');
    const songSearch = songSelectorDiv.querySelector('#song-search');
    songSelector.addEventListener('change', (e) => handleSongSelection(e.target.value));
    songSearch.addEventListener('input', () => {
        const q = songSearch.value.toLowerCase();
        // Rebuild options filtered by search query on decoded strings
        if (!songList || songList.length === 0) return;
        songSelector.innerHTML = '<option value="">Select a song...</option>';
        songList
          .filter(s => safeDecode(s).toLowerCase().includes(q))
          .forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = safeDecode(s);
            songSelector.appendChild(opt);
          });
    });

    // YouTube URL Input (only in YouTube mode)
    const youtubeDiv = document.createElement('div');
    youtubeDiv.id = 'youtube-controls';
    youtubeDiv.style.marginBottom = '10px';
    youtubeDiv.style.display = 'none'; // Hidden by default (local mode)
    youtubeDiv.innerHTML = `
        <label style="display: block; margin-bottom: 5px; color: var(--light-color, #f4f8fc);">YouTube URL:</label>
        <div style="display: flex; gap: 8px;">
            <input type="text" id="youtube-url-input" placeholder="Paste YouTube video or playlist URL..." 
                   style="flex: 1; padding: 8px; border-radius: 4px; border: 1px solid var(--primary-color, #2c4c7c); 
                          background-color: var(--secondary-color, #0c4061); color: var(--light-color, #f4f8fc);">
            <button id="youtube-play-btn" style="padding: 8px 12px; border: none; border-radius: 4px; 
                                                 background: var(--tertiary-color, #0d9edb); color: white; cursor: pointer; font-weight: bold;">
                Play
            </button>
        </div>
    `;
    modal.appendChild(youtubeDiv);

    // YouTube controls
    const youtubeInput = youtubeDiv.querySelector('#youtube-url-input');
    const youtubePlayBtn = youtubeDiv.querySelector('#youtube-play-btn');
    
    youtubePlayBtn.addEventListener('click', () => {
        const url = youtubeInput.value.trim();
        console.log('YOUTUBE: Play button clicked with URL:', url);
        if (url) {
            console.log('YOUTUBE: Adding to cache...');
            try { 
                const added = addYouTubeToCachedList(url);
                console.log('YOUTUBE: Cache add result:', added);
            } catch(e) { 
                console.error('YOUTUBE: Cache add failed:', e);
            }
            if (switchToYouTube(url)) {
                youtubeInput.value = '';
                updateNowPlaying('YouTube: Loading...');
                console.log('YOUTUBE: Successfully switched to YouTube');
            } else {
                console.error('YOUTUBE: Failed to switch to YouTube');
                alert('Invalid YouTube URL or YouTube player not ready');
            }
        } else {
            console.warn('YOUTUBE: No URL provided');
            alert('Please enter a YouTube URL');
        }
    });

    youtubeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            youtubePlayBtn.click();
        }
    });

    // Cached YouTube list UI (only in YouTube mode)
    const ytListHeader = document.createElement('div');
    ytListHeader.id = 'youtube-list-header';
    ytListHeader.style.margin = '8px 0 4px';
    ytListHeader.style.fontSize = '0.9em';
    ytListHeader.style.color = 'var(--light-color, #f4f8fc)';
    ytListHeader.style.display = 'none'; // Hidden by default
    ytListHeader.textContent = 'Saved YouTube items:';
    modal.appendChild(ytListHeader);

    const ytListContainer = document.createElement('div');
    ytListContainer.id = 'youtube-playlist';
    ytListContainer.style.display = 'none'; // Hidden by default
    ytListContainer.style.flexDirection = 'column';
    ytListContainer.style.gap = '12px';
    ytListContainer.style.overflowY = 'auto';
    ytListContainer.style.padding = '12px 8px';
    ytListContainer.style.border = '1px solid var(--primary-color, #2c4c7c)';
    ytListContainer.style.borderRadius = '8px';
    ytListContainer.style.maxHeight = 'min(48vh, 420px)';
    ytListContainer.style.minHeight = '100px';
    ytListContainer.style.fontSize = '0.95rem';
    ytListContainer.style.lineHeight = '1.35';
    modal.appendChild(ytListContainer);

    // Ensure we render any cached items when modal is created
    console.log('Modal created, rendering cached YouTube items:', cachedYouTubePlaylist.length);
    refreshCachedYouTubeListUI();

    // Mode Toggle (Local Files vs YouTube)
    const modeToggleDiv = document.createElement('div');
    modeToggleDiv.style.marginBottom = '10px';
    modeToggleDiv.innerHTML = `
        <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: var(--light-color, #f4f8fc); font-size: 0.9em;">Mode:</span>
            <button id="local-mode-btn" style="padding: 6px 12px; border: none; border-radius: 4px; 
                                             background: var(--primary-color, #2c4c7c); color: white; cursor: pointer; font-size: 0.8em;">
                Local Files
            </button>
            <button id="youtube-mode-btn" style="padding: 6px 12px; border: none; border-radius: 4px; 
                                               background: var(--secondary-color, #0c4061); color: white; cursor: pointer; font-size: 0.8em;">
                YouTube
            </button>
        </div>
    `;
    modal.appendChild(modeToggleDiv);

    // Mode toggle functionality
    const localModeBtn = modeToggleDiv.querySelector('#local-mode-btn');
    const youtubeModeBtn = modeToggleDiv.querySelector('#youtube-mode-btn');
    
    const updateModeButtons = () => {
        if (isYouTubeMode) {
            localModeBtn.style.background = 'var(--secondary-color, #0c4061)';
            youtubeModeBtn.style.background = 'var(--primary-color, #2c4c7c)';
        } else {
            localModeBtn.style.background = 'var(--primary-color, #2c4c7c)';
            youtubeModeBtn.style.background = 'var(--secondary-color, #0c4061)';
        }
    };
    
    localModeBtn.addEventListener('click', () => {
        console.log('MODE: Switching to local files mode');
        
        // Stop all YouTube playback (both streaming and cached)
        if (youtubePlayer) {
            try {
                youtubePlayer.pauseVideo();
            } catch (e) {
                console.log('YouTube player not available');
            }
        }
        
        // Stop audio player if it was playing YouTube content
        if (!audioPlayer.paused && isYouTubeMode) {
            audioPlayer.pause();
            audioPlayer.src = ''; // Clear source to prevent confusion
        }
        
        // Stop YouTube progress polling
        stopYouTubeProgressPolling();
        
        isYouTubeMode = false;
        isPlaying = false;
        updateModeButtons();
        updateUIForStopped();
        updateNowPlaying('Local mode - select a local song');
        
        // Hide YouTube controls
        document.getElementById('youtube-controls').style.display = 'none';
        document.getElementById('youtube-list-header').style.display = 'none';
        document.getElementById('youtube-playlist').style.display = 'none';
        
        console.log('MODE: Now in local files mode - only local MP3s will play');
    });
    
    youtubeModeBtn.addEventListener('click', () => {
        console.log('MODE: Switching to YouTube mode');
        
        // Stop local audio playback 
        if (!audioPlayer.paused && !isYouTubeMode) {
            audioPlayer.pause();
            audioPlayer.src = ''; // Clear source to prevent confusion
        }
        
        isYouTubeMode = true;
        isPlaying = false;
        updateModeButtons();
        updateUIForStopped();
        updateNowPlaying('YouTube mode - play YouTube content');
        
        // Show YouTube controls
        document.getElementById('youtube-controls').style.display = 'block';
        document.getElementById('youtube-list-header').style.display = 'block';
        document.getElementById('youtube-playlist').style.display = 'flex';
        
        // Refresh the list when switching to YouTube mode
        console.log('YOUTUBE: Refreshing UI on mode switch');
        refreshCachedYouTubeListUI();
        
        console.log('MODE: Now in YouTube mode - only YouTube content will play');
    });
    
    updateModeButtons();

    // Now Playing display
    const nowPlayingDiv = document.createElement('div');
    nowPlayingDiv.id = 'now-playing';
    nowPlayingDiv.style.fontWeight = 'bold';
    nowPlayingDiv.style.marginBottom = '10px';
    nowPlayingDiv.style.color = 'rgba(var(--light-color-r, 244), var(--light-color-g, 248), var(--light-color-b, 252), 0.8)';
    nowPlayingDiv.style.wordBreak = 'break-word';
    nowPlayingDiv.style.fontSize = '0.95rem';
    nowPlayingDiv.textContent = 'Not playing...';
    modal.appendChild(nowPlayingDiv);

    // Progress Bar Section
    const progressSection = document.createElement('div');
    progressSection.style.marginBottom = '10px';
    progressSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
            <span id="current-time" style="font-size: 0.8em; color: var(--light-color, #f4f8fc);">0:00</span>
            <span id="duration" style="font-size: 0.8em; color: var(--light-color, #f4f8fc);">0:00</span>
        </div>
        <input type="range" id="progress-bar" min="0" max="100" value="0" style="width: 100%; height: 6px; background: var(--secondary-color, #0c4061); outline: none; border-radius: 3px; cursor: pointer;">
    `;
    modal.appendChild(progressSection);

    const progressBar = progressSection.querySelector('#progress-bar');
    progressBar.style.accentColor = 'var(--tertiary-color, #0d9edb)';
    progressBar.addEventListener('click', handleProgressBarClick);

    // Main Controls Container
    const controlsContainer = document.createElement('div');
    controlsContainer.style.display = 'grid';
    controlsContainer.style.gridTemplateColumns = '1fr 1fr 1fr';
    controlsContainer.style.gap = '8px';
    controlsContainer.style.marginBottom = '10px';
    modal.appendChild(controlsContainer);

    // Previous Button
// Previous Button
    const prevBtn = createButton('⏮ Prev', () => {
        window.lofi.previous(); // Use the standardized previous function
    }, 'var(--primary-color, #2c4c7c)');
    controlsContainer.appendChild(prevBtn);

    // Play/Pause Button
    const playPauseBtn = createButton('▶ Play', () => {
        if (audioPlayer.paused || audioPlayer.ended || !audioPlayer.src) {
            lofi.start();
        } else {
            lofi.stop();
        }
    }, 'var(--primary-color, #2c4c7c)');
    playPauseBtn.id = 'play-pause-btn';
    controlsContainer.appendChild(playPauseBtn);

    // Skip Button
    const skipBtn = createButton('⏭ Skip', () => playNextSong('user'), 'var(--primary-color, #2c4c7c)');
    controlsContainer.appendChild(skipBtn);

    // Additional Controls
    const additionalControls = document.createElement('div');
    additionalControls.style.display = 'grid';
    additionalControls.style.gridTemplateColumns = '1fr 1fr';
    additionalControls.style.gap = '8px';
    additionalControls.style.marginBottom = '10px';
    modal.appendChild(additionalControls);

    // Shuffle Button
    const shuffleBtn = createButton('🔀 Shuffle: Off', toggleShuffle, 'var(--primary-color, #2c4c7c)');
    shuffleBtn.id = 'shuffle-btn';
    additionalControls.appendChild(shuffleBtn);

    // Repeat Button
    const repeatBtn = createButton('🔁 Repeat: Off', toggleRepeat, 'var(--primary-color, #2c4c7c)');
    repeatBtn.id = 'repeat-btn';
    additionalControls.appendChild(repeatBtn);

    // Volume Slider
    const volumeDiv = document.createElement('div');
    volumeDiv.style.display = 'flex';
    volumeDiv.style.alignItems = 'center';
    volumeDiv.style.gap = '10px';
    volumeDiv.style.marginBottom = '10px';
    volumeDiv.innerHTML = `
        <label for="volume-slider" style="white-space: nowrap;">Volume:</label>
        <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="${config.volume}" style="width: 100%;">
        <span id="volume-display">${Math.round(config.volume * 100)}%</span>
    `;
    modal.appendChild(volumeDiv);

    const volumeSlider = volumeDiv.querySelector('#volume-slider');
    const volumeDisplay = volumeDiv.querySelector('#volume-display');
    volumeSlider.style.accentColor = 'var(--tertiary-color, #0d9edb)';
    volumeSlider.style.backgroundColor = 'var(--secondary-color, #0c4061)';
    volumeDisplay.style.color = 'var(--light-color, #f4f8fc)';

    volumeSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        lofi.volume(v);
        volumeDisplay.textContent = `${Math.round(v * 100)}%`;
        try {
            if (config.persistence?.enabled) {
                localStorage.setItem(config.persistence.volumeKey, String(Math.max(0, Math.min(1, v))));
            }
        } catch(_){}
    });

    // Normalization Section
    const normalizationSection = document.createElement('div');
    normalizationSection.style.borderTop = '1px solid var(--primary-color, #2c4c7c)';
    normalizationSection.style.paddingTop = '10px';
    normalizationSection.style.marginTop = '10px';
    normalizationSection.style.display = 'flex';
    normalizationSection.style.flexDirection = 'column';
    normalizationSection.style.gap = '8px';
    modal.appendChild(normalizationSection);

    // Normalization Toggle
    const normToggleDiv = document.createElement('div');
    normToggleDiv.style.display = 'flex';
    normToggleDiv.style.alignItems = 'center';
    normToggleDiv.style.gap = '5px';
    normToggleDiv.innerHTML = `
        <input type="checkbox" id="normalization-toggle" ${config.normalization.enabled ? 'checked' : ''}>
        <label for="normalization-toggle">Normalize Audio</label>
        <span id="norm-status" style="font-size: 0.8em; color: ${config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)'};">(${config.normalization.enabled ? 'On' : 'Off'})</span>
    `;
    normalizationSection.appendChild(normToggleDiv);

    const normToggle = normToggleDiv.querySelector('#normalization-toggle');
    const normStatus = normToggleDiv.querySelector('#norm-status');
    normToggle.style.accentColor = 'var(--tertiary-color, #0d9edb)';
    normToggle.style.color = 'var(--light-color, #f4f8fc)';
    normToggleDiv.querySelector('label').style.color = 'var(--light-color, #f4f8fc)';

    normToggle.addEventListener('change', () => {
        lofi.toggleNormalization();
        normStatus.textContent = `(${config.normalization.enabled ? 'On' : 'Off'})`;
        normStatus.style.color = config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)';
    });

    // Target Loudness Input
    const targetLoudnessDiv = document.createElement('div');
    targetLoudnessDiv.style.display = 'flex';
    targetLoudnessDiv.style.alignItems = 'center';
    targetLoudnessDiv.style.gap = '5px';
    targetLoudnessDiv.innerHTML = `
        <label for="target-lufs">Target LUFS:</label>
        <input type="number" id="target-lufs" value="${config.normalization.targetLoudness}" min="-40" max="-10" step="1" style="width: 70px; padding: 5px; border-radius: 4px; border: 1px solid var(--primary-color, #2c4c7c); background-color: var(--secondary-color, #0c4061); color: var(--light-color, #f4f8fc);">
    `;
    normalizationSection.appendChild(targetLoudnessDiv);

    targetLoudnessDiv.querySelector('label').style.color = 'var(--light-color, #f4f8fc)';
    const targetLufsInput = targetLoudnessDiv.querySelector('#target-lufs');
    targetLufsInput.addEventListener('change', (e) => {
        lofi.setTargetLoudness(parseInt(e.target.value));
    });

    // Logout and Clear Local Cache Button
    const logoutClearCacheBtn = createButton('Log out of quiz user account', async () => {
        if (confirm('Are you sure you want to log out? This will clear ALL cached data and force a complete reload. This may take a moment.')) {
            try {
                // Show loading state
                const originalText = logoutClearCacheBtn.textContent;
                logoutClearCacheBtn.textContent = 'Clearing cache...';
                logoutClearCacheBtn.disabled = true;

                // Clear all caches
                const cacheCleared = await clearAllCaches();
                
                // Show success message briefly
                logoutClearCacheBtn.textContent = 'Cache cleared! Reloading...';
                
                // Always attempt to reload the page, regardless of cache clearing success
                setTimeout(() => {
                    // Force hard reload with cache busting - multiple methods for maximum compatibility
                    const currentUrl = window.location.href.split('?')[0].split('#')[0]; // Remove existing params
                    const cacheBuster = `?_cb=${Date.now()}&_t=${Math.random()}&_reload=1`;
                    const newUrl = currentUrl + cacheBuster;
                    
                    // Method 1: Replace current history entry (no back button)
                    try {
                        window.location.replace(newUrl);
                    } catch (e1) {
                        console.warn('location.replace failed:', e1);
                        
                        // Method 2: Force reload with cache bypass
                        try {
                            window.location.reload(true); // Force from server
                        } catch (e2) {
                            console.warn('location.reload(true) failed:', e2);
                            
                            // Method 3: Standard href change
                            try {
                                window.location.href = newUrl;
                            } catch (e3) {
                                console.warn('location.href failed:', e3);
                                
                                // Method 4: Last resort - meta refresh
                                const meta = document.createElement('meta');
                                meta.httpEquiv = 'refresh';
                                meta.content = `0; url=${newUrl}`;
                                document.head.appendChild(meta);
                            }
                        }
                    }
                }, 1000); // Give user 1 second to see the success message
                
            } catch (error) {
                console.error('Error during logout:', error);
                alert('An error occurred while clearing caches, but the page will still reload to ensure fresh content.');
                
                // Even if cache clearing failed, still try to reload
                setTimeout(() => {
                    window.location.reload(true);
                }, 500);
            }
        }
    }, 'var(--danger-color, #d32f2f)');
    normalizationSection.appendChild(logoutClearCacheBtn);

    document.body.appendChild(modal);

    // Set up event listeners for audio player
    audioPlayer.addEventListener('timeupdate', updateProgressBar);
    audioPlayer.addEventListener('loadedmetadata', () => {
        updateProgressBar();
        populateSongSelector();
    });

    // Update UI based on audio player events - use proper cleanup
    const handlePlayingEvent = () => {
        const currentSong = audioPlayer.src.split('/').pop().split('?')[0];
        updateUIForPlaying(decodeURIComponent(currentSong));
        isPlaying = true;
    };

    const handlePauseEvent = () => {
        if (audioPlayer.src) {
            const currentSong = audioPlayer.src.split('/').pop().split('?')[0];
            updateUIForPaused(decodeURIComponent(currentSong));
        } else {
            updateUIForStopped();
        }
        isPlaying = false;
    };

    const handleEndedEvent = () => {
        nowPlayingDiv.textContent = 'Loading next...';
    };

    // Remove any existing listeners to prevent duplicates
    audioPlayer.removeEventListener('playing', handlePlayingEvent);
    audioPlayer.removeEventListener('pause', handlePauseEvent);
    audioPlayer.removeEventListener('ended', handleEndedEvent);
    
    // Add fresh event listeners
    audioPlayer.addEventListener('playing', handlePlayingEvent);
    audioPlayer.addEventListener('pause', handlePauseEvent);
    audioPlayer.addEventListener('ended', handleEndedEvent);

    // Initialize UI based on saved state and config
    if (savedPlaybackState) {
        if (savedPlaybackState.currentSong) {
            const savedSongName = savedPlaybackState.currentSong.split('/').pop().split('?')[0];
            if (savedPlaybackState.isPlaying) {
                updateUIForPlaying(decodeURIComponent(savedSongName));
            } else {
                updateUIForPaused(decodeURIComponent(savedSongName));
            }
        }
    }
    
    // Update UI elements based on loaded config
    shuffleBtn.textContent = config.shuffle ? '🔀 Shuffle: On' : '🔀 Shuffle: Off';
    shuffleBtn.style.backgroundColor = config.shuffle ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)';
    
    if (config.repeat === 'one') {
        repeatBtn.textContent = '🔂 Repeat: One';
        repeatBtn.style.backgroundColor = 'var(--info-color, #0d61aa)';
    } else if (config.repeat === 'all') {
        repeatBtn.textContent = '🔁 Repeat: All';
        repeatBtn.style.backgroundColor = 'var(--success-color, #2e8b34)';
    } else {
        repeatBtn.textContent = '🔁 Repeat: Off';
        repeatBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
    }
    
    volumeSlider.value = config.volume;
    volumeDisplay.textContent = `${Math.round(config.volume * 100)}%`;
    normToggle.checked = config.normalization.enabled;
    normStatus.textContent = `(${config.normalization.enabled ? 'On' : 'Off'})`;
    normStatus.style.color = config.normalization.enabled ? 'var(--success-color, #2e8b34)' : 'var(--warning-color, #e65100)';
    targetLufsInput.value = config.normalization.targetLoudness;

    // Populate song selector initially (may be empty until songs load)
    populateSongSelector();
    
    // If songs aren't loaded yet, try to initialize them
    if (songList.length === 0) {
        console.log('🔄 Songs not loaded, initializing...');
        initializeSongList().then(() => {
            console.log('🎵 Songs loaded, updating UI...');
            // Repopulate selector once songs are loaded
            populateSongSelector();
        }).catch(error => {
            console.error('❌ Failed to initialize songs:', error);
        });
    }
};

// Helper to create buttons
const createButton = (text, onClickHandler, bgColor) => {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.backgroundColor = bgColor;
    button.style.color = 'var(--light-color, #f4f8fc)';
    button.style.border = 'none';
    button.style.padding = '8px 12px';
    button.style.borderRadius = '5px';
    button.style.cursor = 'pointer';
    button.style.fontSize = '14px';
    button.style.transition = 'background-color 0.2s';

    let baseColorValue = getComputedStyle(document.documentElement).getPropertyValue(bgColor.replace('var(', '').replace(')', '').split(',')[0].trim());
    if (!baseColorValue || baseColorValue.trim() === '') {
        baseColorValue = bgColor.replace('var(', '').replace(')', '').split(',')[1].trim();
    }

    button.addEventListener('mouseover', () => {
        let hoverColor = darkenColor(baseColorValue, 10);
        button.style.backgroundColor = hoverColor;
    });
    button.addEventListener('mouseout', () => button.style.backgroundColor = bgColor);
    button.addEventListener('click', onClickHandler);
    return button;
};

// Helper function to darken a hex or rgb color
const darkenColor = (color, percent) => {
    if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g).map(Number);
        const r = Math.max(0, rgb[0] - percent);
        const g = Math.max(0, rgb[1] - percent);
        const b = Math.max(0, rgb[2] - percent);
        return `rgb(${r}, ${g}, ${b})`;
    } else {
        let f = parseInt(color.slice(1), 16),
            t = percent < 0 ? 0 : 255,
            p = percent < 0 ? percent * -1 : percent / 100,
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = f & 0x0000ff;
        return "#" + (
            0x1000000 +
            (Math.round((t - R) * p) + R) * 0x10000 +
            (Math.round((t - G) * p) + G) * 0x100 +
            (Math.round((t - B) * p) + B)
        ).toString(16).slice(1);
    }
};

// Toggle modal visibility
const toggleModal = () => {
    const modal = document.getElementById('lofi-player-modal');
    const icon = document.getElementById('lofi-player-icon');
    if (modal.style.display === 'none' || modal.style.display === '') {
        modal.style.display = 'flex';
        icon.style.display = 'none';
    } else {
        modal.style.display = 'none';
        icon.style.display = 'flex';
    }
};

// Enhanced CSS styles
const style = document.createElement('style');
style.innerHTML = `
    :root {
        --primary-color: #2c4c7c;
        --secondary-color: #0c4061;
        --tertiary-color: #0d9edb;
        --dark-color: #0e1827;
        --light-color: #f4f8fc;
        --success-color: #2e8b34;
        --danger-color: #d32f2f;
        --warning-color: #e65100;
        --info-color: #0d61aa;
    }

    #lofi-player-modal input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        height: 8px;
        background: var(--secondary-color, #0c4061);
        outline: none;
        border-radius: 5px;
        cursor: pointer;
        box-shadow: inset 0 0 5px rgba(0,0,0,0.3);
    }

    #lofi-player-modal input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: grab;
        margin-top: -6px;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
    }

    #lofi-player-modal input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: grab;
        box-shadow: 0 0 5px rgba(0,0,0,0.5);
        border: none;
    }

    #lofi-player-modal input[type="range"]::-webkit-slider-runnable-track {
        background: var(--secondary-color, #0c4061);
        border-radius: 5px;
    }

    #lofi-player-modal input[type="range"]::-moz-range-track {
        background: var(--secondary-color, #0c4061);
        border-radius: 5px;
    }

    #progress-bar {
        -webkit-appearance: none;
        appearance: none;
        height: 6px !important;
        background: var(--secondary-color, #0c4061);
        outline: none;
        border-radius: 3px;
        cursor: pointer;
        box-shadow: inset 0 0 3px rgba(0,0,0,0.3);
    }

    #progress-bar::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: pointer;
        box-shadow: 0 0 3px rgba(0,0,0,0.5);
    }

    #progress-bar::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--tertiary-color, #0d9edb);
        cursor: pointer;
        box-shadow: 0 0 3px rgba(0,0,0,0.5);
        border: none;
    }

    #song-selector {
        font-size: 14px;
    }

    #song-selector option {
        background-color: var(--secondary-color, #0c4061);
        color: var(--light-color, #f4f8fc);
    }
`;
document.head.appendChild(style);