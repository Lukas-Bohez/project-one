// Background service worker - manages offscreen document and message routing

let offscreenReady = false;
let directoryHandle = null;
let currentTrackList = [];
let currentIndex = -1;
let shuffle = false;
let repeat = 'off'; // 'off', 'one', 'all'

// Create offscreen document for audio playback
async function createOffscreen() {
    try {
        const hasDoc = await chrome.offscreen.hasDocument();
        if (!hasDoc) {
            await chrome.offscreen.createDocument({
                url: 'offscreen.html',
                reasons: ['AUDIO_PLAYBACK'],
                justification: 'Play audio tracks in the background'
            });
            console.log('Offscreen document created');
        }
        offscreenReady = true;
        
        // Re-send directory handle if we have one
        if (directoryHandle) {
            await sendToOffscreen({ action: 'setDirectoryHandle', handle: directoryHandle });
        }
        
        return true;
    } catch (err) {
        console.error('Failed to create offscreen:', err);
        return false;
    }
}

// Send message to offscreen document
async function sendToOffscreen(message) {
    try {
        // Ensure offscreen exists
        const hasDoc = await chrome.offscreen.hasDocument();
        if (!hasDoc) {
            await createOffscreen();
        }
        return await chrome.runtime.sendMessage(message);
    } catch (err) {
        console.error('sendToOffscreen error:', err);
        // Try recreating offscreen
        await createOffscreen();
        return await chrome.runtime.sendMessage(message);
    }
}

// Get next track index
function getNextIndex() {
    if (currentTrackList.length === 0) return -1;
    
    if (repeat === 'one') {
        return currentIndex;
    }
    
    if (shuffle) {
        return Math.floor(Math.random() * currentTrackList.length);
    }
    
    const next = currentIndex + 1;
    if (next >= currentTrackList.length) {
        return repeat === 'all' ? 0 : -1;
    }
    return next;
}

// Get previous track index
function getPrevIndex() {
    if (currentTrackList.length === 0) return -1;
    
    if (shuffle) {
        return Math.floor(Math.random() * currentTrackList.length);
    }
    
    const prev = currentIndex - 1;
    return prev < 0 ? currentTrackList.length - 1 : prev;
}

// Initialize
createOffscreen();

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Messages from offscreen document
    if (sender.url && sender.url.includes('offscreen.html')) {
        switch (message.action) {
            case 'songEnded':
                // Auto-advance to next track
                const nextIdx = getNextIndex();
                if (nextIdx >= 0 && currentTrackList[nextIdx]) {
                    currentIndex = nextIdx;
                    const nextTrack = currentTrackList[nextIdx];
                    // Notify popup
                    chrome.runtime.sendMessage({ 
                        action: 'autoAdvance', 
                        index: nextIdx,
                        track: nextTrack 
                    }).catch(() => {});
                    // Play next
                    sendToOffscreen({ action: 'playSong', song: nextTrack });
                } else {
                    // Notify popup playback stopped
                    chrome.runtime.sendMessage({ action: 'playbackStopped' }).catch(() => {});
                }
                break;
                
            case 'timeUpdate':
            case 'metadataLoaded':
            case 'playFailed':
                // Forward to popup
                chrome.runtime.sendMessage(message).catch(() => {});
                break;
        }
        return;
    }
    
    // Messages from popup
    switch (message.action) {
        case 'createOffscreen':
            createOffscreen()
                .then(success => sendResponse({ success }))
                .catch(() => sendResponse({ success: false }));
            return true;
            
        case 'play':
            currentIndex = message.index;
            currentTrackList = message.trackList || currentTrackList;
            const track = currentTrackList[currentIndex];
            if (track) {
                sendToOffscreen({ action: 'playSong', song: track })
                    .then(res => sendResponse(res))
                    .catch(err => sendResponse({ ok: false, error: err.message }));
            } else {
                sendResponse({ ok: false, error: 'Track not found' });
            }
            return true;
            
        case 'pause':
            sendToOffscreen({ action: 'pause' })
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ ok: false }));
            return true;
            
        case 'resume':
            sendToOffscreen({ action: 'resume' })
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ ok: false }));
            return true;
            
        case 'stop':
            sendToOffscreen({ action: 'stop' })
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ ok: false }));
            return true;
            
        case 'seek':
            sendToOffscreen({ action: 'seek', time: message.time })
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ ok: false }));
            return true;
            
        case 'setVolume':
            sendToOffscreen({ action: 'setVolume', volume: message.volume })
                .then(res => sendResponse(res))
                .catch(err => sendResponse({ ok: false }));
            return true;
            
        case 'next':
            const nextI = getNextIndex();
            if (nextI >= 0) {
                currentIndex = nextI;
                const nextT = currentTrackList[nextI];
                sendToOffscreen({ action: 'playSong', song: nextT })
                    .then(() => sendResponse({ ok: true, index: nextI }))
                    .catch(err => sendResponse({ ok: false }));
            } else {
                sendResponse({ ok: false, error: 'No next track' });
            }
            return true;
            
        case 'prev':
            const prevI = getPrevIndex();
            if (prevI >= 0) {
                currentIndex = prevI;
                const prevT = currentTrackList[prevI];
                sendToOffscreen({ action: 'playSong', song: prevT })
                    .then(() => sendResponse({ ok: true, index: prevI }))
                    .catch(err => sendResponse({ ok: false }));
            } else {
                sendResponse({ ok: false, error: 'No previous track' });
            }
            return true;
            
        case 'setDirectoryHandle':
            directoryHandle = message.handle;
            sendToOffscreen({ action: 'setDirectoryHandle', handle: message.handle })
                .then(() => sendResponse({ ok: true }))
                .catch(() => sendResponse({ ok: false }));
            return true;
            
        case 'clearDirectoryHandle':
            directoryHandle = null;
            sendResponse({ ok: true });
            break;
            
        case 'setTrackList':
            currentTrackList = message.trackList || [];
            currentIndex = message.index || 0;
            sendResponse({ ok: true });
            break;
            
        case 'setShuffle':
            shuffle = message.shuffle;
            sendResponse({ ok: true });
            break;
            
        case 'setRepeat':
            repeat = message.repeat;
            sendResponse({ ok: true });
            break;
            
        case 'getStatus':
            sendToOffscreen({ action: 'getStatus' })
                .then(status => sendResponse({ 
                    ...status, 
                    currentIndex, 
                    shuffle, 
                    repeat,
                    trackCount: currentTrackList.length 
                }))
                .catch(() => sendResponse({ currentIndex, shuffle, repeat }));
            return true;
    }
});

console.log('Background service worker initialized');
