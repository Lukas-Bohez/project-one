// Offscreen audio player using Web Audio API
let audioContext = null;
let currentSource = null;
let currentSong = null;
let isPlayingSong = false;
let gainNode = null;
let analyserNode = null;
let playQueue = [];
let currentBuffer = null;
let playbackPosition = 0;
let startTime = 0;
let paused = false;
// Single interval id used for time updates to avoid multiple timers and jitter
let updateIntervalId = null;

// Initialize Web Audio API
async function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        analyserNode = audioContext.createAnalyser();
        gainNode.connect(analyserNode);
        analyserNode.connect(audioContext.destination);
        gainNode.gain.value = 0.1; // Default volume
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}




// Track latest play request id to ignore stale requests
let _lastSeenPlayRequestId = 0;

// Handle messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'playSong':
            // If this play request has a requestId and it's stale, ignore it
            try {
                const reqId = message.song && message.song.requestId;
                if (typeof reqId === 'number' && reqId < _lastSeenPlayRequestId) {
                    console.log('Ignoring stale playSong request:', reqId);
                    try { sendResponse({ ok: false, reason: 'stale' }); } catch (e) {}
                    break;
                }
                if (typeof reqId === 'number') {
                    _lastSeenPlayRequestId = reqId;
                }
            } catch (e) {}
            // Always play the requested song; allow replacing current playback
            playSong(message.song);
            try { sendResponse({ ok: true }); } catch (e) {}
            break;
        case 'setDirectoryHandle':
            // Keep a reference to the directory handle in the offscreen context
            try {
                window._persistentDirHandle = message.handle;
                console.log('Offscreen received directory handle to keep open');
                try { sendResponse({ ok: true }); } catch (e) {}
            } catch (err) {
                try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {}
            }
            break;

        case 'ping':
            // Lightweight keep-alive
            try { sendResponse({ ok: true }); } catch (e) {}
            break;
        case 'ensureHandle':
            // Confirm whether offscreen currently has a directory handle
            try {
                if (window._persistentDirHandle) {
                    try { sendResponse({ ok: true }); } catch (e) {}
                } else {
                    try { sendResponse({ ok: false }); } catch (e) {}
                }
            } catch (err) {
                try { sendResponse({ ok: false, error: err && err.message ? err.message : String(err) }); } catch (e) {}
            }
            break;
        case 'pause':
            if (currentSource && !paused) {
                playbackPosition = audioContext.currentTime - startTime;
                currentSource.stop();
                currentSource = null;
                paused = true;
                isPlayingSong = false;
            }
            // Clear time update interval immediately to avoid stale updates
            if (updateIntervalId) { clearInterval(updateIntervalId); updateIntervalId = null; }
            try { sendResponse({ ok: true }); } catch (e) {}
            break;
        case 'resume':
            if (paused && currentSong && !isPlayingSong) {
                playSong(currentSong, playbackPosition);
            }
            try { sendResponse({ ok: true }); } catch (e) {}
            break;
        case 'setVolume':
            if (gainNode) {
                gainNode.gain.value = message.volume;
            }
            sendResponse(); // Acknowledge receipt
            break;
        case 'seek':
            // Restart playback from requested time position
            (async () => {
                try {
                    const t = message.time;
                    if (typeof t === 'number' && currentSong) {
                        // Stop current source and play from new position
                        if (currentSource) {
                            try { currentSource.onended = null; } catch (e) {}
                            try { currentSource.stop(); } catch (e) {}
                            currentSource = null;
                        }
                        playbackPosition = t;
                        paused = false;
                        // Bump request id so any in-flight decodes are considered stale
                        try { _lastSeenPlayRequestId += 1; } catch (e) { _lastSeenPlayRequestId = _lastSeenPlayRequestId || 0; _lastSeenPlayRequestId += 1; }
                        const playCopy = Object.assign({}, currentSong, { requestId: _lastSeenPlayRequestId });
                        await playSong(playCopy, playbackPosition);
                        try { sendResponse({ success: true }); } catch (e) {}
                        return;
                    }
                    try { sendResponse({ success: false, error: 'Invalid seek' }); } catch (e) {}
                } catch (err) {
                    try { sendResponse({ success: false, error: err.message }); } catch (e) {}
                }
            })();
            return true;
        case 'getStatus':
            sendResponse({
                playing: isPlayingSong,
                currentTime: currentSource ? audioContext.currentTime - (currentSource.startTime || 0) : 0,
                duration: currentSong ? currentSong.duration : 0,
                volume: gainNode ? gainNode.gain.value : 0.1
            });
            break;


    }
    // For synchronous messages, don't return true
});

// Play a song using Web Audio API
async function playSong(song, resumePosition = 0) {
    try {
        await initAudioContext();
        // Clear any pending queued songs when a new manual play is requested
        playQueue = [];
        const requestId = song && song.requestId;
        if (typeof requestId === 'number') {
            // If this request has an id that is already stale compared to _lastSeenPlayRequestId, abort early
            if (requestId < _lastSeenPlayRequestId) {
                console.log('Aborting playSong early because request is stale:', requestId, 'lastSeen:', _lastSeenPlayRequestId);
                return;
            }
        }
        
        // Stop current playback, but prevent previous onended handlers from firing
        if (currentSource) {
            console.log('Stopping existing source before playing new song');
            try { currentSource.onended = null; } catch (e) {}
            try { currentSource.stop(); } catch (e) { console.warn('Error stopping previous source', e); }
            currentSource = null;
        }
        
        isPlayingSong = true;
        currentSong = song;
        paused = false;

        console.log('playSong requested:', song && (song.id || song.file || song.url));
        if (audioContext) console.log('audioContext.sampleRate:', audioContext.sampleRate);

        // Resolve URL via file handles or direct url and fetch/decode audio
        let url = song.url;
        if (!url) {
            try {
                if (song.handle && typeof song.handle.getFile === 'function') {
                    const file = await song.handle.getFile();
                    url = URL.createObjectURL(file);
                } else if (song.dirHandle && song.filename) {
                    try {
                        const fileHandle = await song.dirHandle.getFileHandle(song.filename);
                        const file = await fileHandle.getFile();
                        url = URL.createObjectURL(file);
                    } catch (error) {
                        console.error('Error resolving file from directory handle:', error);
                        chrome.runtime.sendMessage({ action: 'playFailed', error: 'Failed to access file from directory' });
                        return;
                    }
                }
            } catch (error) {
                console.error('Error getting file from handle:', error);
                chrome.runtime.sendMessage({ action: 'playFailed', error: 'Failed to access file' });
                return;
            }
        }

        // Fetch and decode audio
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            // continue with playback
        } catch (err) {
            console.error('Play failed:', err);
            isPlayingSong = false;
            chrome.runtime.sendMessage({ action: 'playFailed', error: err && err.message ? err.message : String(err) });
            return;
        }

        // Before creating/starting the source, ensure this request is still the latest
        if (typeof requestId === 'number' && requestId !== _lastSeenPlayRequestId) {
            console.log('Aborting start: request became stale during decode:', requestId, 'lastSeen:', _lastSeenPlayRequestId);
            return;
        }
        
        // Create source and play
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = audioBuffer;
        currentSource.connect(gainNode);
        
        // Add error handler
        currentSource.onerror = (error) => {
            console.error('Audio source error:', error);
            isPlayingSong = false;
            chrome.runtime.sendMessage({ action: 'audioError', error: 'Audio playback error' });
        };
        
        startTime = audioContext.currentTime - resumePosition;
        console.log('Starting source at resume position:', resumePosition, 'buffer duration:', audioBuffer.duration);
        currentSource.start(0, resumePosition);
        
        // Notify success
        chrome.runtime.sendMessage({
            action: 'metadataLoaded',
            duration: audioBuffer.duration
        });
        
        // Set up end handler
        currentSource.onended = () => {
            if (!paused) {
                isPlayingSong = false;
                chrome.runtime.sendMessage({ action: 'songEnded' });
                // Play next in queue
                if (playQueue.length > 0) {
                    const nextSong = playQueue.shift();
                    setTimeout(() => playSong(nextSong), 100);
                }
            }
        };
        
        // Start time update loop (ensure single running interval)
        startTimeUpdates(audioBuffer.duration, startTime);
        
    } catch (error) {
        console.error('Play failed:', error);
        isPlayingSong = false;
        chrome.runtime.sendMessage({ action: 'playFailed', error: error.message });
        // Play next in queue
        if (playQueue.length > 0) {
            const nextSong = playQueue.shift();
            setTimeout(() => playSong(nextSong), 100);
        }
    }
}

function startTimeUpdates(duration, startTimeParam) {
    // Clear any existing interval to avoid duplicate senders
    if (updateIntervalId) { clearInterval(updateIntervalId); updateIntervalId = null; }

    // Send an immediate update so UI can show duration/currentTime right away
    try {
        chrome.runtime.sendMessage({ action: 'timeUpdate', currentTime: Math.max(0, audioContext.currentTime - startTimeParam), duration: duration });
    } catch (e) {}

    // Also send a metadataLoaded message so UI can update duration immediately if needed
    try { chrome.runtime.sendMessage({ action: 'metadataLoaded', duration: duration }); } catch (e) {} 

    updateIntervalId = setInterval(() => {
        // Only send updates while actually playing and not paused
        if (isPlayingSong && !paused && currentSource) {
            const elapsed = audioContext.currentTime - startTimeParam;
            // Clamp elapsed to [0, duration]
            const clamped = Math.max(0, Math.min(duration || Number.POSITIVE_INFINITY, elapsed));
            try {
                chrome.runtime.sendMessage({ action: 'timeUpdate', currentTime: clamped, duration: duration });
            } catch (e) {}
        } else {
            // Stop interval when not playing
            if (updateIntervalId) { clearInterval(updateIntervalId); updateIntervalId = null; }
        }
    }, 200);
}