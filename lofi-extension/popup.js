// Lofi Player Popup - Clean rewrite
// DOM Elements
const statusEl = document.getElementById('lofi-status');
const listEl = document.getElementById('song-selector');
const playBtn = document.getElementById('play-pause-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const volumeEl = document.getElementById('volume-slider');
const volumeDisplay = document.getElementById('volume-display');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const nowPlayingEl = document.getElementById('now-playing');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');
const modeSelector = document.getElementById('mode-selector');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
const unloadButton = document.getElementById('unload-button');
const fileControls = document.getElementById('file-controls');
const closeBtn = document.getElementById('lofi-close-btn');
const thumbnailEl = document.getElementById('track-thumbnail');
const thumbnailContainer = document.getElementById('thumbnail-container');

// State
let tracks = [];
let currentIndex = 0;
let isPlaying = false;
let shuffle = false;
let repeat = 'off'; // 'off', 'one', 'all'
let currentMode = 'bundled'; // 'bundled', 'files'
let duration = 0;
let directoryHandle = null;

// Initialize
async function init() {
    // Create offscreen document
    const response = await chrome.runtime.sendMessage({ action: 'createOffscreen' });
    if (response && response.success) {
        console.log('Offscreen document ready');
    }
    
    // Set initial volume display
    if (volumeDisplay && volumeEl) {
        volumeDisplay.textContent = Math.round(volumeEl.value * 100) + '%';
    }
    
    // Load saved state
    loadState();
    
    // Set default mode to bundled
    if (modeSelector) modeSelector.value = 'bundled';
    if (fileControls) fileControls.style.display = 'none';
    
    // Load bundled tracks by default (but don't auto-play)
    await loadBundledTracks();
    
    // Reset playback state
    isPlaying = false;
    currentIndex = 0;
    
    updateUI();
}

// Save/Load state
function saveState() {
    chrome.storage.local.set({
        lofi_shuffle: shuffle,
        lofi_repeat: repeat,
        lofi_volume: volumeEl ? parseFloat(volumeEl.value) : 0.1
    });
}

function loadState() {
    chrome.storage.local.get(['lofi_shuffle', 'lofi_repeat', 'lofi_volume'], (data) => {
        if (data.lofi_shuffle !== undefined) {
            shuffle = data.lofi_shuffle;
            if (shuffleBtn) shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
        }
        if (data.lofi_repeat !== undefined) {
            repeat = data.lofi_repeat;
            if (repeatBtn) repeatBtn.textContent = `Repeat: ${repeat}`;
        }
        if (data.lofi_volume !== undefined && volumeEl) {
            volumeEl.value = data.lofi_volume;
            if (volumeDisplay) volumeDisplay.textContent = Math.round(data.lofi_volume * 100) + '%';
            chrome.runtime.sendMessage({ action: 'setVolume', volume: data.lofi_volume });
        }
    });
}

// Load bundled tracks
async function loadBundledTracks() {
    try {
        const response = await fetch(chrome.runtime.getURL('assets/tracks.json'));
        const trackData = await response.json();
        
        tracks = trackData.map(track => ({
            file: track.file,
            title: track.title || track.file.replace(/\.[^/.]+$/, ''),
            artist: track.artist || '',
            url: chrome.runtime.getURL(`lofi/${track.file}`),
            id: track.file
        }));
        
        currentIndex = 0;
        renderTrackList();
        updateUI();
        statusEl.textContent = `Loaded ${tracks.length} bundled tracks`;
        
        // Send track list to background
        await chrome.runtime.sendMessage({ action: 'setTrackList', trackList: tracks, index: 0 });
        
    } catch (err) {
        console.error('Failed to load bundled tracks:', err);
        statusEl.textContent = 'Failed to load bundled tracks';
    }
}

// Load user-selected files
function loadFiles(files) {
    try {
        console.log('Loading', files.length, 'files...');
        
        // Filter for audio files
        const audioFiles = files.filter(file => {
            const ext = file.name.toLowerCase().split('.').pop();
            return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
        });
        
        console.log('Found', audioFiles.length, 'audio files');
        
        if (audioFiles.length === 0) {
            statusEl.textContent = 'No audio files found in selection';
            tracks = [];
            renderTrackList();
            updateUI();
            return;
        }
        
        // Sort files alphabetically
        audioFiles.sort((a, b) => a.name.localeCompare(b.name));
        
        // Create track objects from files
        tracks = audioFiles.map((file, index) => ({
            file: file.name,
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: '',
            url: URL.createObjectURL(file),
            id: `user_${index}_${file.name}`,
            fileObject: file
        }));
        
        currentIndex = 0;
        isPlaying = false;
        renderTrackList();
        updateUI();
        statusEl.textContent = `✓ Loaded ${tracks.length} audio file${tracks.length !== 1 ? 's' : ''} - Click to play`;
        
        // Send track list to background
        chrome.runtime.sendMessage({ action: 'setTrackList', trackList: tracks, index: 0 });
        
    } catch (err) {
        console.error('Failed to load files:', err);
        statusEl.textContent = 'Failed to load files: ' + err.message;
        tracks = [];
        renderTrackList();
        updateUI();
    }
}

// Load folder (handled by folder input with webkitdirectory)
// This function is kept for compatibility but folder loading now happens via input element

// Unload folder
function unloadFolder() {
    chrome.runtime.sendMessage({ action: 'stop' });
    tracks = [];
    directoryHandle = null;
    currentIndex = 0;
    isPlaying = false;
    
    // Clear file inputs
    if (fileInput) fileInput.value = '';
    if (folderInput) folderInput.value = '';
    
    renderTrackList();
    updateUI();
    statusEl.textContent = currentMode === 'bundled' ? 'Switched to bundled mode' : 'Files cleared - Select files or folder';
}

// Render track list
function renderTrackList() {
    listEl.innerHTML = '';
    
    tracks.forEach((track, index) => {
        const div = document.createElement('div');
        div.className = 'song-item' + (index === currentIndex ? ' selected' : '');
        div.dataset.index = index;
        
        const info = document.createElement('div');
        info.className = 'song-info';
        info.innerHTML = `
            <div class="song-title">${track.title || track.file}</div>
            <div class="song-artist">${track.artist || ''}</div>
        `;
        
        div.appendChild(info);
        
        div.addEventListener('click', (e) => {
            e.preventDefault();
            playTrack(index);
        });
        
        listEl.appendChild(div);
    });
}

// Update track list selection
function updateTrackSelection() {
    const items = listEl.querySelectorAll('.song-item');
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === currentIndex);
    });
}

// Update song selector with new tracks
function updateSongSelector(trackList) {
    tracks = trackList;
    currentIndex = 0;
    isPlaying = false;
    renderTrackList();
    updateUI();
}

// Play a specific track
async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    
    console.log('Playing track:', index, tracks[index].file);
    
    currentIndex = index;
    
    try {
        // Send play command with full track list
        const response = await chrome.runtime.sendMessage({ 
            action: 'play', 
            index: index,
            trackList: tracks
        });
        
        if (response && response.ok) {
            isPlaying = true;
            updateUI();
            updateTrackSelection();
        } else {
            console.error('Play failed:', response);
            statusEl.textContent = 'Failed to play track';
            isPlaying = false;
        }
    } catch (err) {
        console.error('Error playing track:', err);
        statusEl.textContent = 'Error: ' + err.message;
        isPlaying = false;
        updateUI();
    }
}

// Play/Pause toggle
function togglePlay() {
    if (tracks.length === 0) return;
    
    if (isPlaying) {
        chrome.runtime.sendMessage({ action: 'pause' });
        isPlaying = false;
    } else {
        if (currentIndex >= 0) {
            chrome.runtime.sendMessage({ action: 'resume' }, (res) => {
                if (!res || !res.ok) {
                    // If resume fails, try playing current track
                    playTrack(currentIndex);
                }
            });
        } else {
            playTrack(0);
        }
        isPlaying = true;
    }
    updateUI();
}

// Next track
function nextTrack() {
    if (tracks.length === 0) return;
    
    chrome.runtime.sendMessage({ action: 'next' }, (res) => {
        if (res && res.ok) {
            currentIndex = res.index;
            isPlaying = true;
            updateUI();
            updateTrackSelection();
        }
    });
}

// Previous track
function prevTrack() {
    if (tracks.length === 0) return;
    
    chrome.runtime.sendMessage({ action: 'prev' }, (res) => {
        if (res && res.ok) {
            currentIndex = res.index;
            isPlaying = true;
            updateUI();
            updateTrackSelection();
        }
    });
}

// Seek
function seek(e) {
    if (duration <= 0) return;
    
    const rect = progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * duration;
    
    chrome.runtime.sendMessage({ action: 'seek', time: Math.max(0, time) });
}

// Set volume
function setVolume() {
    const vol = parseFloat(volumeEl.value);
    chrome.runtime.sendMessage({ action: 'setVolume', volume: vol });
    if (volumeDisplay) volumeDisplay.textContent = Math.round(vol * 100) + '%';
    saveState();
}

// Toggle shuffle
function toggleShuffle() {
    shuffle = !shuffle;
    chrome.runtime.sendMessage({ action: 'setShuffle', shuffle });
    if (shuffleBtn) shuffleBtn.textContent = `Shuffle: ${shuffle ? 'On' : 'Off'}`;
    saveState();
}

// Toggle repeat
function toggleRepeat() {
    if (repeat === 'off') repeat = 'one';
    else if (repeat === 'one') repeat = 'all';
    else repeat = 'off';
    
    chrome.runtime.sendMessage({ action: 'setRepeat', repeat });
    if (repeatBtn) repeatBtn.textContent = `Repeat: ${repeat}`;
    saveState();
}

// Update UI
function updateUI() {
    // Play button
    if (playBtn) {
        playBtn.textContent = isPlaying ? '⏸' : '▶';
    }
    
    // Now playing
    if (nowPlayingEl) {
        if (tracks.length > 0 && currentIndex >= 0 && currentIndex < tracks.length) {
            const track = tracks[currentIndex];
            nowPlayingEl.textContent = track ? (track.title || track.file) : 'Select a track';
        } else if (tracks.length > 0) {
            nowPlayingEl.textContent = 'Click a track to play';
        } else {
            nowPlayingEl.textContent = currentMode === 'bundled' ? 'Loading tracks...' : 'Select files or folder';
        }
    }
    
    // Status
    if (statusEl) {
        if (tracks.length > 0 && currentIndex >= 0 && currentIndex < tracks.length) {
            const track = tracks[currentIndex];
            if (track) {
                statusEl.textContent = `${isPlaying ? 'Playing' : 'Ready'}: ${track.title || track.file}`;
            }
        } else if (tracks.length > 0) {
            statusEl.textContent = `${tracks.length} tracks loaded - Click to play`;
        } else {
            statusEl.textContent = currentMode === 'bundled' ? 'Loading bundled tracks...' : 'Select files or folder';
        }
    }
}

// Format time
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Message listener for updates from background/offscreen
chrome.runtime.onMessage.addListener((message) => {
    switch (message.action) {
        case 'timeUpdate':
            if (currentTimeEl) currentTimeEl.textContent = formatTime(message.currentTime);
            if (durationEl) durationEl.textContent = formatTime(message.duration);
            duration = message.duration;
            
            if (progressBar && message.duration > 0) {
                const percent = (message.currentTime / message.duration) * 100;
                progressBar.style.width = percent + '%';
            }
            break;
            
        case 'metadataLoaded':
            duration = message.duration;
            if (durationEl) durationEl.textContent = formatTime(message.duration);
            break;
            
        case 'autoAdvance':
            currentIndex = message.index;
            isPlaying = true;
            updateUI();
            updateTrackSelection();
            break;
            
        case 'playbackStopped':
            isPlaying = false;
            updateUI();
            break;
            
        case 'playFailed':
            statusEl.textContent = 'Failed: ' + message.error;
            isPlaying = false;
            updateUI();
            break;
    }
});

// Event listeners
if (playBtn) playBtn.addEventListener('click', togglePlay);
if (prevBtn) prevBtn.addEventListener('click', prevTrack);
if (nextBtn) nextBtn.addEventListener('click', nextTrack);
if (volumeEl) volumeEl.addEventListener('input', setVolume);
if (progressContainer) progressContainer.addEventListener('click', seek);
if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);
if (repeatBtn) repeatBtn.addEventListener('click', toggleRepeat);
if (unloadButton) unloadButton.addEventListener('click', unloadFolder);

// Folder input handler
if (folderInput) folderInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        loadFiles(files);
    }
});

// Mode selector
if (modeSelector) modeSelector.addEventListener('change', async (e) => {
    const mode = e.target.value;
    currentMode = mode;
    if (mode === 'bundled') {
        fileControls.style.display = 'none';
        await loadBundledTracks();
    } else if (mode === 'files') {
        fileControls.style.display = 'block';
        // Clear current tracks when switching to files mode
        chrome.runtime.sendMessage({ action: 'stop' });
        chrome.runtime.sendMessage({ action: 'clearTracks' });
        updateSongSelector([]);
        statusEl.textContent = 'Select files or folder to load tracks';
    }
});

// File input
if (fileInput) fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        loadFiles(files);
    }
});

// Close button - STOP playback when closing
if (closeBtn) {
    closeBtn.addEventListener('click', () => {
        // Stop playback when closing
        chrome.runtime.sendMessage({ action: 'stop' });
        window.close();
    });
}

// Also stop when window unloads
window.addEventListener('beforeunload', () => {
    chrome.runtime.sendMessage({ action: 'stop' });
});

// Initialize
init();
