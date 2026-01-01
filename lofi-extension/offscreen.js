// Offscreen audio player - Simple Web Audio API implementation
let audioContext = null;
let currentSource = null;
let gainNode = null;
let currentBuffer = null;
let startTime = 0;
let playbackPosition = 0;
let isPlaying = false;
let paused = false;
let currentSongId = null;
let updateInterval = null;

// Directory handle for file access
// Not needed since tracks contain their own entries

async function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.connect(audioContext.destination);
        gainNode.gain.value = 0.1;
    }
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

function stopCurrent() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }
    if (currentSource) {
        try { currentSource.onended = null; } catch (e) {}
        try { currentSource.disconnect(); } catch (e) {}
        try { currentSource.stop(); } catch (e) {}
        currentSource = null;
    }
    isPlaying = false;
}

async function playSong(song, resumeFrom = 0) {
    console.log('offscreen playSong:', song.file || song.id);
    
    // Stop any current playback first
    stopCurrent();
    
    await initAudio();
    
    currentSongId = song.id || song.file;
    
    // Get audio data
    let arrayBuffer;
    try {
        if (song.entry) {
            // Use the FileEntry directly
            const file = await new Promise((resolve, reject) => {
                song.entry.file(resolve, reject);
            });
            arrayBuffer = await file.arrayBuffer();
        } else if (song.url) {
            // Fetch from URL
            const response = await fetch(song.url);
            arrayBuffer = await response.arrayBuffer();
        } else {
            throw new Error('No audio source available');
        }
    } catch (err) {
        console.error('Failed to get audio data:', err);
        chrome.runtime.sendMessage({ action: 'playFailed', error: err.message });
        return;
    }
    
    // Decode audio
    try {
        currentBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (err) {
        console.error('Failed to decode audio:', err);
        chrome.runtime.sendMessage({ action: 'playFailed', error: 'Failed to decode audio' });
        return;
    }
    
    // Create and start source
    currentSource = audioContext.createBufferSource();
    currentSource.buffer = currentBuffer;
    currentSource.connect(gainNode);
    
    startTime = audioContext.currentTime - resumeFrom;
    playbackPosition = resumeFrom;
    
    currentSource.onended = () => {
        if (isPlaying && !paused) {
            isPlaying = false;
            chrome.runtime.sendMessage({ action: 'songEnded' });
        }
    };
    
    currentSource.start(0, resumeFrom);
    isPlaying = true;
    paused = false;
    
    // Send duration
    chrome.runtime.sendMessage({ 
        action: 'metadataLoaded', 
        duration: currentBuffer.duration 
    });
    
    // Start time updates
    startTimeUpdates();
}

function startTimeUpdates() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(() => {
        if (isPlaying && !paused && currentBuffer) {
            const currentTime = audioContext.currentTime - startTime;
            chrome.runtime.sendMessage({
                action: 'timeUpdate',
                currentTime: Math.min(currentTime, currentBuffer.duration),
                duration: currentBuffer.duration
            });
        }
    }, 250);
}

function pause() {
    if (currentSource && isPlaying) {
        playbackPosition = audioContext.currentTime - startTime;
        stopCurrent();
        paused = true;
    }
}

function resume() {
    if (paused && currentBuffer) {
        currentSource = audioContext.createBufferSource();
        currentSource.buffer = currentBuffer;
        currentSource.connect(gainNode);
        
        startTime = audioContext.currentTime - playbackPosition;
        
        currentSource.onended = () => {
            if (isPlaying && !paused) {
                isPlaying = false;
                chrome.runtime.sendMessage({ action: 'songEnded' });
            }
        };
        
        currentSource.start(0, playbackPosition);
        isPlaying = true;
        paused = false;
        startTimeUpdates();
    }
}

function seek(time) {
    if (currentBuffer) {
        const wasPlaying = isPlaying;
        stopCurrent();
        playbackPosition = Math.max(0, Math.min(time, currentBuffer.duration));
        
        if (wasPlaying || paused) {
            currentSource = audioContext.createBufferSource();
            currentSource.buffer = currentBuffer;
            currentSource.connect(gainNode);
            
            startTime = audioContext.currentTime - playbackPosition;
            
            currentSource.onended = () => {
                if (isPlaying && !paused) {
                    isPlaying = false;
                    chrome.runtime.sendMessage({ action: 'songEnded' });
                }
            };
            
            currentSource.start(0, playbackPosition);
            isPlaying = true;
            paused = false;
            startTimeUpdates();
        }
    }
}

function setVolume(vol) {
    if (gainNode) {
        gainNode.gain.value = Math.max(0, Math.min(1, vol));
    }
}

function stop() {
    stopCurrent();
    currentBuffer = null;
    currentSongId = null;
    paused = false;
    playbackPosition = 0;
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'playSong':
            playSong(message.song, message.resumeFrom || 0)
                .then(() => sendResponse({ ok: true }))
                .catch(err => sendResponse({ ok: false, error: err.message }));
            return true;
            
        case 'pause':
            pause();
            sendResponse({ ok: true });
            break;
            
        case 'resume':
            resume();
            sendResponse({ ok: true });
            break;
            
        case 'stop':
            stop();
            sendResponse({ ok: true });
            break;
            
        case 'seek':
            seek(message.time);
            sendResponse({ ok: true });
            break;
            
        case 'setVolume':
            setVolume(message.volume);
            sendResponse({ ok: true });
            break;
            
        case 'setDirectoryEntry':
            // Not needed since tracks contain their own entries
            sendResponse({ ok: true });
            break;
            
        case 'getStatus':
            sendResponse({
                isPlaying: isPlaying,
                paused: paused,
                currentTime: isPlaying ? audioContext.currentTime - startTime : playbackPosition,
                duration: currentBuffer ? currentBuffer.duration : 0,
                volume: gainNode ? gainNode.gain.value : 0.1,
                songId: currentSongId
            });
            break;
            
        case 'ping':
            sendResponse({ ok: true });
            break;
    }
});

console.log('Offscreen audio player initialized');
