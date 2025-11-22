// Simple Random Lofi Player - Enhanced with Shuffle and Repeat Modes
// API Configuration (use different name to avoid conflict with converter.js)
const LOFI_API_BASE_URL = `https://${window.location.hostname}`;

// Use unified cache constants from window (set by converter.js)
// Reference them directly from window to avoid redeclaration errors

// Configuration
const config = {
    volume: 0.00005, // Extremely quiet default (0.005%)
    fadeDuration: 500, // Reduced from 1000ms to 500ms for faster transitions
    shuffle: true, // Default shuffle mode (true = random, false = sequential)
    repeat: false, // Repeat mode: false, 'one', or 'all'
    enableLofi: false, // Disable lofi player by default to prevent 404 errors
    mode: 'cache', // 'cache' or 'local' - cache uses IndexedDB, local scans folder
    folder: 'https://quizthespire.com/lofi/', // Folder to scan for local MP3 files
    disabled: false, // Whether music is disabled
    normalization: {
        enabled: true,
        targetLoudness: -35, // Further reduced to -35 LUFS for much quieter playback
        analysisTime: 3000, // How long to analyze each track (ms)
        cache: true // Cache normalization data
    },
    persistence: { // Enhanced persistence configuration
        enabled: true,
        localStorageKey: 'lofiPlayerState',
        normalizationCacheKey: 'lofiNormalizationCache',
        playerEnabledKey: 'lofiPlayerEnabled',
        volumeKey: 'lofiVolume',
        currentPlaylistKey: 'lofiCurrentPlaylist'
    }
};

// ADD YOUR AUDIO FILENAMES HERE (only if folder scanning doesn't work)
const manualSongList = [
    // Example: 'my-song.mp3', 'another-track.wav', 'chill-beat.mp3'
    // Leave empty to try folder scanning first
    // Default fallback song in case cache is empty
    {
        id: 'fallback-lofi',
        title: 'Lofi Fallback Track',
        filename: 'fallback-lofi.mp3'
    }
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

let lofiActivated = false; // Track if user has activated the lofi player

// --- Persistence Variables ---
let savedPlaybackState = null; // To hold state loaded from localStorage
let cachedVolume = config.volume; // Cached volume setting
let isPlayerEnabled = false; // Cached player enabled state

// --- Unicode/URL helpers ---
const isPercentEncoded = (s) => /%[0-9A-Fa-f]{2}/.test(s);
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// Unified cache functions for lofi (using converter.js functions if available)
const openLofiDB = async () => {
    // Use unified cache if converter.js functions are available
    if (typeof openUnifiedCacheDB === 'function') {
        return await openUnifiedCacheDB();
    }
    
    // Fallback to direct unified cache access
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(window.UNIFIED_CACHE_DB || 'unified_media_cache_v1');
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const storeName = window.CACHE_STORE_MEDIA || 'media_files';
            if (!db.objectStoreNames.contains(storeName)) {
                const store = db.createObjectStore(storeName, { keyPath: 'id' });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('videoId', 'videoId', { unique: false });
                store.createIndex('created', 'created', { unique: false });
            }
        };
    });
};

// Get all cached downloads from unified cache (same as converter.js)
async function getAllCachedDownloads() {
    try {
        const db = await openLofiDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(window.CACHE_STORE_MEDIA || 'media_files', 'readonly');
            const store = tx.objectStore(window.CACHE_STORE_MEDIA || 'media_files');
            const req = store.getAll();
            req.onsuccess = function(e) {
                resolve(e.target.result || []);
            };
            req.onerror = function(e) {
                console.error('❌ Error reading all cached downloads:', e);
                reject(e.target ? e.target.error : e);
            };
        });
    } catch (error) {
        console.error('❌ Error accessing download cache:', error);
        return [];
    }
}

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
        const storeName = window.CACHE_STORE_MEDIA || 'media_files';
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            // First try direct lookup by ID
            const request = store.get(videoId);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    resolve(result);
                    return;
                }
                
                // If not found by ID, search through all entries for matching videoId
                const cursorRequest = store.openCursor();
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const entry = cursor.value;
                        if (entry.videoId === videoId) {
                            resolve(entry);
                            return;
                        }
                        cursor.continue();
                    } else {
                        // Not found
                        resolve(null);
                    }
                };
                cursorRequest.onerror = () => reject(cursorRequest.error);
            };
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
        const storeName = window.CACHE_STORE_MEDIA || 'media_files';
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const record = {
            id: videoId,
            download_id: videoId,
            videoId: videoId,
            blob: blob,
            status: 'ready',
            title: metadata.title || videoId,
            filename: `${metadata.title || videoId}.mp3`,
            fileExt: 'mp3',
            size: blob.size,
            type: 'lofi',
            created: Date.now(),
            format: 'MP3',
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
        const storeName = window.CACHE_STORE_MEDIA || 'media_files';
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const typeIndex = store.index('type');
        
        return new Promise((resolve, reject) => {
            const request = typeIndex.getAllKeys(IDBKeyRange.only('lofi'));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error listing cached audio keys:', error);
        return [];
    }
};

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

// Forcefully sync all cached items from IndexedDB to lofi playlist
const syncCacheToPlaylist = async () => {
    try {
        console.log('🔄 Syncing IndexedDB cache to lofi playlist...');
        const allCached = await getAllCachedDownloads();
        console.log('All cached downloads:', allCached);
        
        let addedCount = 0;
        for (const item of allCached) {
            const title = item.metadata?.title || item.filename || 'Unknown';
            const songPath = item.downloadId; // Use downloadId as identifier
            
            // Check if already in songList
            const exists = songList.some(song => song.id === item.downloadId);
            if (!exists) {
                songList.push({
                    id: item.downloadId,
                    title: prettyTitle(title),
                    filename: item.filename,
                    blob: item.blob,
                    metadata: item.metadata
                });
                addedCount++;
                console.log('➕ Added to playlist:', prettyTitle(title));
            }
        }
        
        if (addedCount > 0) {
            console.log(`✅ Synced ${addedCount} new items from cache`);
        } else {
            console.log('ℹ️ No new items to sync from cache');
        }
        
        return addedCount;
    } catch (error) {
        console.error('❌ Error in syncCacheToPlaylist:', error);
        return 0;
    }
};

// Deduplicate playlist - if title has .mp3 extension, skip it
const deduplicatePlaylist = (playlist) => {
    const result = [];
    
    for (const item of playlist) {
        const hasExtension = /\.(mp3|mp4|webm)$/i.test(item.title || '');
        
        if (hasExtension) {
            console.log('⏭️ Skipping file with extension:', item.title);
            continue;
        }
        
        result.push(item);
    }
    
    console.log(`📊 Deduplication: ${playlist.length} → ${result.length} items (removed ${playlist.length - result.length} with extensions)`);
    return result;
};

// Expose for manual triggering from console
window.syncCacheToPlaylist = syncCacheToPlaylist;

const updateCachedAudioStatus = async (videoId, updates) => {
    try {
        const db = await openLofiDB();
        const storeName = window.CACHE_STORE_MEDIA || 'media_files';
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
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

// Load persisted simple settings early (enable flag, volume)
const loadPersistentSettings = () => {
    try {
        if (!config.persistence?.enabled) return;
        const enabledRaw = localStorage.getItem(config.persistence.playerEnabledKey);
        isPlayerEnabled = enabledRaw ? JSON.parse(enabledRaw) : false;

        const volRaw = localStorage.getItem(config.persistence.volumeKey);
        if (volRaw !== null) {
            const v = parseFloat(volRaw);
            if (Number.isFinite(v) && v <= 0.0001) { // Only keep cached volume if it's already extremely quiet (<= 0.01%)
                cachedVolume = Math.max(0, Math.min(1, v));
                config.volume = cachedVolume; // sync config default for UI
            } else {
                // Reset louder cached volumes to the new quiet default
                cachedVolume = config.volume;
                localStorage.setItem(config.persistence.volumeKey, String(config.volume));
                console.log('🔊 Reset cached volume to quiet default:', config.volume);
            }
        }

        // Load disabled state
        const disabledRaw = localStorage.getItem('lofi_disabled');
        config.disabled = disabledRaw ? JSON.parse(disabledRaw) : false;

        // Load mode preference
        const modeRaw = localStorage.getItem('lofi_mode');
        if (modeRaw && (modeRaw === 'cache' || modeRaw === 'local')) {
            config.mode = modeRaw;
        }
    } catch (err) {
        console.warn('Failed to load persistent settings:', err);
        isPlayerEnabled = false;
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

    // Initialize UI elements (only if not disabled)
    if (!config.disabled) {
        createFloatingIcon();
        createLofiModal();
    } else {
        // Create enable button when disabled
        createEnableButton();
    }

    // Apply cached volume now that DOM/UI exists (if not disabled)
    if (!config.disabled) {
        try {
            audioPlayer.volume = Math.max(0, Math.min(1, cachedVolume));
            const slider = document.getElementById('volume-slider');
            const display = document.getElementById('volume-display');
            if (slider) slider.value = cachedVolume;
            if (display) display.textContent = `${Math.round(cachedVolume * 100)}%`;
        } catch(_) {}
    }

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



























// Initialize when DOM is ready (respect persisted activation)
document.addEventListener('DOMContentLoaded', () => {
    loadPersistentSettings();
    console.log('Lofi player boot. Enabled in cache:', isPlayerEnabled);

    // Forcefully sync IndexedDB cache to playlist immediately (finds converter downloads)
    (async () => {
        try {
            await syncCacheToPlaylist();
        } catch (e) {
            console.warn('Failed to sync cache to playlist:', e);
        }
    })();

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
        console.log('🔄 Initializing song list in', config.mode, 'mode...');
        console.log('Current songList length:', songList ? songList.length : 'undefined');

        // Check if songList has been populated already
        if (songList && songList.length > 0) {
            console.log('📁 Song list already loaded:', songList.length, 'songs');

            // Initialize playlist based on shuffle mode
            if (config.shuffle) {
                createShuffledPlaylist();
            }

            console.log('✅ Songs ready for playback');
            return songList;
        }

        // Initialize based on current mode
        if (config.mode === 'cache') {
            // Sync from IndexedDB cache
            console.log('🔄 Syncing from cache...');
            try {
                await syncCacheToPlaylist();
            } catch (e) {
                console.warn('Cache sync failed:', e);
            }

            if (songList && songList.length > 0) {
                console.log('📁 Loaded from cache:', songList.length, 'songs');
            } else {
                console.log('⚠️ No cached songs found, falling back to manual list');
                songList = [...manualSongList];
            }
        } else if (config.mode === 'local') {
            // Scan local folder
            console.log('🔄 Scanning local folder...');
            try {
                const files = await scanFolderForMP3s();
                if (files && files.length > 0) {
                    songList = files.map(filename => ({
                        id: filename,
                        title: prettyTitle(filename.replace(/\.(mp3|wav)$/i, '')),
                        filename: filename,
                        url: config.folder + filename
                    }));
                    console.log('📁 Loaded from folder:', songList.length, 'songs');
                } else {
                    console.log('⚠️ No local files found, falling back to manual list');
                    songList = [...manualSongList];
                }
            } catch (e) {
                console.warn('Folder scan failed:', e);
                songList = [...manualSongList];
            }
        } else {
            // Fallback to manual songs
            console.log('📝 Using manual song list');
            songList = [...manualSongList];
        }

        // Initialize playlist based on shuffle mode
        if (config.shuffle) {
            createShuffledPlaylist();
        }

        console.log('✅ Songs ready for playback, total:', songList.length);
        return songList;

    } catch (error) {
        console.error('Failed to initialize song list:', error);
        // Ultimate fallback
        songList = [...manualSongList];
        console.log('📝 Emergency fallback to manual song list');
        return songList;
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

                // Clamp gain to reasonable limits (0.1x to 2.0x) - reduced max gain for quieter playback
                const clampedGain = Math.max(0.1, Math.min(2.0, targetGain));

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

    console.log('Starting playback...');

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

    console.log('❌ No songs loaded from cache');
};

// Handles loading the first song, either from persistence or based on mode
const handleInitialSongLoad = () => {
    if (config.persistence.enabled && savedPlaybackState && savedPlaybackState.currentSong) {
        const savedSongId = savedPlaybackState.currentSong;
        
        // Find the saved song in songList
        const savedSong = songList.find(song => song.id === savedSongId);
        
        if (savedSong) {
            console.log(`Attempting to load saved song: ${savedSong.title} at ${savedPlaybackState.currentTime.toFixed(1)}s`);
            
            // Set current indices based on saved song
            const savedIndex = songList.indexOf(savedSong);
            currentSongIndex = savedIndex;
            
            if (config.shuffle && shuffledPlaylist.length > 0) {
                const shuffledIndex = shuffledPlaylist.indexOf(savedSong);
                if (shuffledIndex !== -1) {
                    currentPlaylistIndex = shuffledIndex + 1; // +1 because it will be used for next song
                }
            }
            
            loadAndPlayCached(savedSong, savedPlaybackState.currentTime, savedPlaybackState.volume, savedPlaybackState.isPlaying);
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


// Play next song with mode awareness
const playNextSong = (initiator = 'user') => {
    if (songList.length === 0) {
        console.log('No songs available');
        return;
    }

    // Handle repeat one mode
    if (initiator === 'auto' && config.repeat === 'one' && audioPlayer.src) {
        // Repeat current song only for auto-advance
        try {
            audioPlayer.currentTime = 0;
            // Ensure ended handler is attached again (the previous one was once-only)
            audioPlayer.addEventListener('ended', handleSongEnded, { once: true });
            audioPlayer.play().then(() => {
                isPlaying = true;
                updateUIForPlaying(audioPlayer.currentSong ? audioPlayer.currentSong.title : 'Unknown');
                console.log('🔂 Repeating current song (auto)');
            }).catch(err => {
                console.warn('Repeat-one auto play() failed, reloading track:', err);
                // Fallback: reload the same track
                // Find current song object
                const currentSongObj = songList.find(song => song.id === audioPlayer.currentSongId);
                if (currentSongObj) {
                    loadAndPlayCached(currentSongObj);
                }
            });
        } catch (e) {
            console.warn('Repeat-one auto failed; trying reload:', e);
            const currentSongObj = songList.find(song => song.id === audioPlayer.currentSongId);
            if (currentSongObj) {
                loadAndPlayCached(currentSongObj);
            }
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

    console.log('▶ Playing:', nextSong.title, `(${config.shuffle ? 'shuffle' : 'sequential'} mode)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlayCached(nextSong);
        });
    } else {
        loadAndPlayCached(nextSong);
    }
};

// Play previous song
const playPreviousSong = () => {
    if (songList.length === 0) {
        console.log('No songs available');
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

    console.log('⏮ Previous:', previousSong.title, `(${config.shuffle ? 'shuffle' : 'sequential'} mode)`);

    // Fade out current song if playing
    if (!audioPlayer.paused) {
        fadeOut(audioPlayer, () => {
            loadAndPlayCached(previousSong);
        });
    } else {
        loadAndPlayCached(previousSong);
    }
};

// Legacy function for compatibility - now uses mode-aware playback
const playRandomSong = () => {
    playNextSong();
};

// Load and play song (cached blob or local URL) with fade in and normalization
const loadAndPlayCached = (songObj, startTime = 0, initialVolume = 0, shouldPlay = true) => {
    // Clean up any existing event listeners
    audioPlayer.removeEventListener('ended', handleSongEnded);
    
    if (songObj.blob) {
        // Cached song with blob
        const objectUrl = URL.createObjectURL(songObj.blob);
        audioPlayer.src = objectUrl;
    } else if (songObj.url) {
        // Local song with URL
        audioPlayer.src = songObj.url;
    } else {
        console.error('No blob or URL for song:', songObj.title);
        return;
    }
    
    audioPlayer.volume = initialVolume; // Start at 0 or the saved initialVolume for fade in

    // Check cache for normalization data
    const cacheKey = songObj.id;
    let cachedGain = null;

    if (config.normalization.cache && normalizationCache.has(cacheKey)) {
        cachedGain = normalizationCache.get(cacheKey);
        console.log('📦 Using cached normalization for:', songObj.title, `(${cachedGain.toFixed(2)}x)`);
    }

    audioPlayer.currentTime = startTime; // Set playback position
    isPlaying = shouldPlay; // Update global state

    // If starting from scratch (or resuming a paused state), try to play
    if (shouldPlay) {
        audioPlayer.play()
            .then(() => {
                console.log('🎵 Now playing:', songObj.title);

                // Update UI immediately (moved here from event listener for quicker response)
                updateUIForPlaying(songObj.title);

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
                console.error('❌ Playback promise failed for:', songObj.title, error);
                handleFailedSong(songObj.title);
                isTransitioning = false;
            });
            
        // Also add a general error listener for the audio element
        audioPlayer.addEventListener('error', (e) => {
            console.error('❌ Audio element error for:', songObj.title, e);
            handleFailedSong(songObj.title);
            isTransitioning = false;
        }, { once: true });
    } else {
        // If not supposed to play (e.g., loaded a paused state)
        audioPlayer.pause();
        updateUIForPaused(songObj.title);
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
console.log('📊 Current normalization target:', config.normalization.targetLoudness, 'LUFS');










// --- Modal Creation and Control ---

// Create the floating icon
const createFloatingIcon = () => {
    const icon = document.createElement('div');
    icon.id = 'lofi-player-icon';
    icon.style.position = 'fixed';
    icon.style.bottom = '20px';
    icon.style.left = '12px';
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

// Create the enable button when music is disabled
const createEnableButton = () => {
    const button = document.createElement('div');
    button.id = 'lofi-enable-button';
    button.style.position = 'fixed';
    button.style.bottom = '20px';
    button.style.left = '12px';
    button.style.backgroundColor = 'var(--warning-color, #e65100)';
    button.style.color = 'var(--light-color, #f4f8fc)';
    button.style.borderRadius = '25px';
    button.style.width = 'auto';
    button.style.minWidth = '50px';
    button.style.height = '50px';
    button.style.display = 'flex';
    button.style.justifyContent = 'center';
    button.style.alignItems = 'center';
    button.style.cursor = 'pointer';
    button.style.zIndex = '1000';
    button.style.fontFamily = 'monospace';
    button.style.fontSize = '20px';
    button.style.padding = '0 15px';
    button.textContent = '🎵 Enable Music';
    button.title = 'Re-enable Lofi Player';

    document.body.appendChild(button);
    button.addEventListener('click', () => {
        if (confirm('Are you sure you want to re-enable music? The player will be restored.')) {
            config.disabled = false;
            localStorage.setItem('lofi_disabled', 'false');
            // Remove enable button
            button.remove();
            // Create the normal icon and modal
            createFloatingIcon();
            createLofiModal();
            // Removed annoying alert popup
        }
    });
};

// Update progress bar
const updateProgressBar = () => {
    const progressBar = document.getElementById('progress-bar');
    const currentTimeSpan = document.getElementById('current-time');
    const durationSpan = document.getElementById('duration');
    
    if (progressBar && currentTimeSpan && durationSpan) {
        let currentTime = 0;
        let duration = 0;
        if (audioPlayer) {
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
    
    if (audioPlayer && audioPlayer.duration) {
        const newTime = (percentage / 100) * audioPlayer.duration;
        audioPlayer.currentTime = newTime;
        progressBar.value = percentage;
    }
};

// Populate song selector dropdown
const populateSongSelector = async () => {
    const songSelector = document.getElementById('song-selector');
    if (songSelector) {
        console.log('🔄 Populating song selector');
        
        if (songList && songList.length > 0) {
            songSelector.innerHTML = '<option value="">Select a song...</option>';
            
            songList.forEach((songObj, index) => {
                const option = document.createElement('option');
                option.value = songObj.id;
                option.textContent = songObj.title;
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
const handleSongSelection = (selectedSongId) => {
    if (isTransitioning) {
        console.log('⏳ Transition in progress, ignoring selection');
        return;
    }
    
    if (!selectedSongId) return;
    
    // Find the selected song object
    const selectedSongObj = songList.find(song => song.id === selectedSongId);
    if (selectedSongObj) {
        // Update indices
        currentSongIndex = songList.indexOf(selectedSongObj);
        if (config.shuffle) {
            createShuffledPlaylistAnchored(selectedSongObj);
        } else {
            currentPlaylistIndex = -1;
        }
        isTransitioning = true;
        loadAndPlayCached(selectedSongObj, 0, 0, true);
    }
};

// Toggle play/pause
const togglePlayPause = () => {
    if (audioPlayer.paused) {
        if (audioPlayer.src) {
            audioPlayer.play().catch(err => console.error('Play failed:', err));
            isPlaying = true;
        } else {
            // No song loaded, start playback
            startPlayback();
        }
    } else {
        audioPlayer.pause();
        isPlaying = false;
    }
};

// Stop playback
const stopPlayback = () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
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
    // Use tighter side offsets so the modal doesn't overflow on small/mobile screens
    // Keep the modal left-aligned on desktop (right:auto) so it doesn't center
    modal.style.left = '12px';
    modal.style.right = 'auto';
    modal.style.width = 'auto';
    modal.style.height = 'auto';
    modal.style.minWidth = '0';
    modal.style.maxWidth = '96vw';
    // Limit modal width on large screens so it doesn't stretch edge-to-edge
    modal.style.maxWidth = '960px';
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
        // Rebuild options filtered by search query
        if (!songList || songList.length === 0) return;
        songSelector.innerHTML = '<option value="">Select a song...</option>';
        songList
          .filter(songObj => songObj.title.toLowerCase().includes(q))
          .forEach(songObj => {
            const opt = document.createElement('option');
            opt.value = songObj.id;
            opt.textContent = songObj.title;
            songSelector.appendChild(opt);
          });
    });
    

    


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

    // Mode Controls
    const modeControls = document.createElement('div');
    modeControls.style.display = 'grid';
    modeControls.style.gridTemplateColumns = '1fr 1fr';
    modeControls.style.gap = '8px';
    modeControls.style.marginBottom = '10px';
    modal.appendChild(modeControls);

    // Cache Mode Button
    const cacheModeBtn = createButton('💾 Cache Mode', () => {
        console.log('🔄 Switching to cache mode...');
        const wasAlreadyCache = config.mode === 'cache';
        config.mode = 'cache';
        localStorage.setItem('lofi_mode', 'cache');
        cacheModeBtn.style.backgroundColor = 'var(--success-color, #2e8b34)';
        localModeBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        
        // Stop current playback and reset player state
        lofi.stop();
        isPlaying = false;
        currentSongIndex = -1;
        currentPlaylistIndex = -1;
        currentSong = null;
        
        // Show loading state in song selector
        const songSelector = document.getElementById('song-selector');
        if (songSelector) songSelector.innerHTML = '<option value="">Switching to cache...</option>';
        
        // Clear existing song list to force reload from new mode
        songList = [];
        initializeSongList().then(() => {
            populateSongSelector();
            startPlayback();
            console.log('✅ Switched to cache mode');
            // Removed annoying alert popup
        }).catch(error => {
            console.error('❌ Failed to switch to cache mode:', error);
            if (songSelector) songSelector.innerHTML = '<option value="">Error loading songs</option>';
        });
    }, config.mode === 'cache' ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)');
    cacheModeBtn.id = 'cache-mode-btn';
    modeControls.appendChild(cacheModeBtn);

    // Local Mode Button
    const localModeBtn = createButton('📁 Local Mode', () => {
        console.log('🔄 Switching to local mode...');
        const wasAlreadyLocal = config.mode === 'local';
        config.mode = 'local';
        localStorage.setItem('lofi_mode', 'local');
        localModeBtn.style.backgroundColor = 'var(--success-color, #2e8b34)';
        cacheModeBtn.style.backgroundColor = 'var(--primary-color, #2c4c7c)';
        
        // Stop current playback and reset player state
        lofi.stop();
        isPlaying = false;
        currentSongIndex = -1;
        currentPlaylistIndex = -1;
        currentSong = null;
        
        // Show loading state in song selector
        const songSelector = document.getElementById('song-selector');
        if (songSelector) songSelector.innerHTML = '<option value="">Switching to local...</option>';
        
        // Clear existing song list to force reload from new mode
        songList = [];
        initializeSongList().then(() => {
            populateSongSelector();
            startPlayback();
            console.log('✅ Switched to local mode');
            // Removed annoying alert popup
        }).catch(error => {
            console.error('❌ Failed to switch to local mode:', error);
            if (songSelector) songSelector.innerHTML = '<option value="">Error loading songs</option>';
        });
    }, config.mode === 'local' ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)');
    localModeBtn.id = 'local-mode-btn';
    modeControls.appendChild(localModeBtn);

    // Disable Music Button
    const disableBtn = createButton('🔇 Disable Music', () => {
        if (confirm('Are you sure you want to disable music? This will stop playback and hide the player.')) {
            lofi.stop();
            modal.style.display = 'none';
            config.disabled = true;
            localStorage.setItem('lofi_disabled', 'true');
            // Removed annoying alert popup - user can see the enable button appears
        }
    }, 'var(--warning-color, #e65100)');
    disableBtn.id = 'disable-music-btn';
    modeControls.appendChild(disableBtn);

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
    
    // Update mode buttons
    cacheModeBtn.style.backgroundColor = config.mode === 'cache' ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)';
    localModeBtn.style.backgroundColor = config.mode === 'local' ? 'var(--success-color, #2e8b34)' : 'var(--primary-color, #2c4c7c)';
    
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

// Enhanced CSS styles (only add if not already present)
if (!document.getElementById('lofi-player-styles')) {
    const lofiPlayerStyle = document.createElement('style');
    lofiPlayerStyle.id = 'lofi-player-styles';
    lofiPlayerStyle.innerHTML = `
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

    /* Responsive adjustments to prevent the player from overflowing on small screens */
    #lofi-player-icon {
        left: 12px;
        bottom: 12px;
        right: auto;
    }

    #lofi-player-modal {
        left: 12px;
        right: auto; /* keep left-aligned on larger viewports */
        min-width: 0;
        max-width: 960px; /* prevent stretching on large desktops */
        box-sizing: border-box;
    }

    @media (max-width: 480px) {
        #lofi-player-modal {
            bottom: 78px; /* slightly above the icon */
            padding: 10px;
            border-radius: 8px;
            max-height: 86vh;
        }
        #lofi-player-icon {
            width: 46px;
            height: 46px;
            font-size: 20px;
        }
    }
`;
    document.head.appendChild(lofiPlayerStyle);
}